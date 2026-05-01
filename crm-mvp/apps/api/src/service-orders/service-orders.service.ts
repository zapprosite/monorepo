import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceOrder, ServiceOrderChecklistItem, ServiceOrderPhoto } from '../entities/serviceOrder.entity';
import { PdfService } from '../pdf/pdf.service';

const DEFAULT_CHECKLIST: Omit<ServiceOrderChecklistItem, 'id'>[] = [
  { label: 'Verificar condição do equipamento', checked: false },
  { label: 'Conferir alimentação elétrica', checked: false },
  { label: 'Inspecionar componentes internos', checked: false },
  { label: 'Realizar teste de funcionamento', checked: false },
  { label: 'Limpar filtros e componentes', checked: false },
  { label: 'Verificar temperatura de operação', checked: false },
  { label: 'Testar controle remoto', checked: false },
  { label: 'Registrar medições na OS', checked: false },
  { label: 'Confirmar funcionamento com cliente', checked: false },
  { label: 'Limpar área de trabalho', checked: false },
];

@Injectable()
export class ServiceOrdersService {
  constructor(
    @InjectRepository(ServiceOrder) private repo: Repository<ServiceOrder>,
    private pdfService: PdfService,
  ) {}

  findAll(filters?: {
    status?: string;
    type?: string;
    priority?: string;
    clientId?: string;
    equipamentoId?: string;
    technicianId?: string;
    search?: string;
  }) {
    const qb = this.repo.createQueryBuilder('so')
      .leftJoinAndSelect('so.client', 'client')
      .leftJoinAndSelect('so.equipamento', 'equipamento')
      .leftJoinAndSelect('so.technician', 'technician');

    if (filters?.status) qb.andWhere('so.status = :status', { status: filters.status });
    if (filters?.type) qb.andWhere('so.type = :type', { type: filters.type });
    if (filters?.priority) qb.andWhere('so.priority = :priority', { priority: filters.priority });
    if (filters?.clientId) qb.andWhere('so.clientId = :clientId', { clientId: filters.clientId });
    if (filters?.equipamentoId) qb.andWhere('so.equipamentoId = :equipamentoId', { equipamentoId: filters.equipamentoId });
    if (filters?.technicianId) qb.andWhere('so.technicianId = :technicianId', { technicianId: filters.technicianId });
    if (filters?.search) {
      qb.andWhere(
        '(so.title ILIKE :search OR so.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return qb.orderBy('so.createdAt', 'DESC').getMany();
  }

  findOne(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['client', 'equipamento', 'technician'],
    });
  }

  create(data: Partial<ServiceOrder>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<ServiceOrder>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { id, deleted: true };
  }

  async complete(id: string, cost?: number, notes?: string) {
    await this.repo.update(id, {
      status: 'concluida',
      completedDate: new Date(),
      ...(cost !== undefined && { cost }),
      ...(notes && { notes }),
    });
    return this.findOne(id);
  }

  async startExecution(id: string) {
    const checklist: ServiceOrderChecklistItem[] = DEFAULT_CHECKLIST.map((item, idx) => ({
      ...item,
      id: `item-${idx + 1}`,
    }));

    await this.repo.update(id, {
      status: 'em_andamento',
      executionStartedAt: new Date(),
      checklist,
      photos: [],
      signature: null,
    });
    return this.findOne(id);
  }

  async updateExecution(
    id: string,
    data: {
      checklist?: ServiceOrderChecklistItem[];
      photos?: ServiceOrderPhoto[];
      signature?: string;
    },
  ) {
    const updateData: Partial<ServiceOrder> = {};
    if (data.checklist !== undefined) updateData.checklist = data.checklist;
    if (data.photos !== undefined) updateData.photos = data.photos;
    if (data.signature !== undefined) updateData.signature = data.signature;

    await this.repo.update(id, updateData);
    return this.findOne(id);
  }

  async submitExecution(id: string, data: { cost?: number; notes?: string }) {
    const so = await this.findOne(id);
    await this.repo.update(id, {
      status: 'concluida',
      completedDate: new Date(),
      ...(data.cost !== undefined && { cost: data.cost }),
      ...(data.notes !== undefined && { notes: data.notes }),
    });

    // make-pdf skill: generate PDF after OS is concluded
    try {
      const updated = await this.findOne(id);
      const pdfUrl = await this.pdfService.generateOsPdf(updated);
      await this.repo.update(id, { pdfUrl });
    } catch (err) {
      console.error('[make-pdf] PDF generation failed for OS', id, err);
    }

    return this.findOne(id);
  }
}
