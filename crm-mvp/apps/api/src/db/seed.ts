import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Team } from './entities/team.entity';
import { User } from './entities/user.entity';
import { Client } from './entities/client.entity';
import { Lead } from './entities/lead.entity';
import { Schedule } from './entities/schedule.entity';
import { Contract } from './entities/contract.entity';
import { Reminder } from './entities/reminder.entity';

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Seeding database...');

  const teamRepo = AppDataSource.getRepository(Team);
  const userRepo = AppDataSource.getRepository(User);
  const clientRepo = AppDataSource.getRepository(Client);
  const leadRepo = AppDataSource.getRepository(Lead);
  const scheduleRepo = AppDataSource.getRepository(Schedule);
  const contractRepo = AppDataSource.getRepository(Contract);
  const reminderRepo = AppDataSource.getRepository(Reminder);

  // Team
  const team = teamRepo.create({ name: 'Equipe Dev', slug: 'equipe-dev' });
  await teamRepo.save(team);
  console.log('✅ Team created');

  // Users
  const user = userRepo.create({
    email: 'dev@crm.local',
    name: 'Dev User',
    teamId: team.id,
  });
  await userRepo.save(user);
  console.log('✅ User created');

  // Clients
  const clients = clientRepo.create([
    {
      name: 'Refrigeração Silva Ltda',
      type: 'pj',
      document: '12.345.678/0001-90',
      email: 'contato@silvaref.com',
      phone: '(11) 98765-4321',
      address: 'Av. Paulista, 1000 — São Paulo, SP',
      tags: ['VIP', 'Recorrente'],
      status: 'ativo',
      teamId: team.id,
    },
    {
      name: 'Maria Oliveira',
      type: 'pf',
      document: '123.456.789-00',
      email: 'maria.o@gmail.com',
      phone: '(11) 91234-5678',
      address: 'Rua das Flores, 42 — São Paulo, SP',
      tags: ['Residencial'],
      status: 'ativo',
      teamId: team.id,
    },
    {
      name: 'Condomínio Central Park',
      type: 'pj',
      document: '98.765.432/0001-10',
      email: 'admin@centralpark.cond',
      phone: '(11) 3456-7890',
      address: 'Rua Augusta, 500 — São Paulo, SP',
      tags: ['Comercial', 'Contrato Anual'],
      status: 'ativo',
      teamId: team.id,
    },
  ]);
  await clientRepo.save(clients);
  console.log(`✅ ${clients.length} Clients created`);

  // Leads
  const leads = leadRepo.create([
    {
      name: 'João Pereira',
      email: 'joao.pereira@email.com',
      phone: '(11) 99876-5432',
      source: 'Indicação',
      status: 'proposta',
      responsibleId: user.id,
      estimatedValue: 3500.0,
      notes: 'Precisa de manutenção preventiva em 5 unidades.',
      teamId: team.id,
    },
    {
      name: 'Supermercado Bom Preço',
      email: 'compras@bompreco.com',
      phone: '(11) 3333-4444',
      source: 'Site',
      status: 'qualificado',
      responsibleId: user.id,
      estimatedValue: 12000.0,
      notes: 'Rede com 3 filiais. Interesse em contrato anual.',
      teamId: team.id,
    },
    {
      name: 'Ana Costa',
      email: 'ana.costa@email.com',
      phone: '(11) 97777-8888',
      source: 'Instagram',
      status: 'novo',
      responsibleId: user.id,
      estimatedValue: 800.0,
      notes: 'Instalação de ar-condicionado residencial.',
      teamId: team.id,
    },
  ]);
  await leadRepo.save(leads);
  console.log(`✅ ${leads.length} Leads created`);

  // Schedules
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(14, 0, 0, 0);

  const schedules = scheduleRepo.create([
    {
      clientId: clients[0].id,
      dateTime: tomorrow,
      type: 'manutencao',
      technicianId: user.id,
      status: 'agendado',
      notes: 'Limpeza de filtros e verificação de gás.',
      teamId: team.id,
    },
    {
      clientId: clients[2].id,
      dateTime: nextWeek,
      type: 'instalacao',
      technicianId: user.id,
      status: 'confirmado',
      notes: 'Instalação de 3 splits novos na área comum.',
      teamId: team.id,
    },
  ]);
  await scheduleRepo.save(schedules);
  console.log(`✅ ${schedules.length} Schedules created`);

  // Contracts
  const today = new Date();
  const endOfYear = new Date(today.getFullYear(), 11, 31);

  const contracts = contractRepo.create([
    {
      clientId: clients[0].id,
      type: 'manutencao',
      value: 4500.0,
      frequency: 'trimestral',
      startDate: today.toISOString().split('T')[0],
      endDate: endOfYear.toISOString().split('T')[0],
      status: 'ativo',
      teamId: team.id,
    },
    {
      clientId: clients[2].id,
      type: 'comercial',
      value: 18000.0,
      frequency: 'anual',
      startDate: today.toISOString().split('T')[0],
      endDate: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().split('T')[0],
      status: 'ativo',
      teamId: team.id,
    },
  ]);
  await contractRepo.save(contracts);
  console.log(`✅ ${contracts.length} Contracts created`);

  // Reminders
  const reminders = reminderRepo.create([
    {
      clientId: clients[0].id,
      title: 'Ligar para confirmar agendamento',
      type: 'ligacao',
      dueDate: tomorrow,
      status: 'pendente',
      teamId: team.id,
    },
    {
      clientId: clients[2].id,
      title: 'Enviar proposta de renovação',
      type: 'renovacao',
      dueDate: new Date(today.getFullYear(), today.getMonth() + 11, 1),
      status: 'pendente',
      teamId: team.id,
    },
  ]);
  await reminderRepo.save(reminders);
  console.log(`✅ ${reminders.length} Reminders created`);

  console.log('\n🎉 Seed completed successfully!');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
