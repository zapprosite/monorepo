import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "@frontend/utils/trpc";

export const MaintenancePlansPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nomeEmpresa: "",
    tipoEquipamento: "ar-condicionado",
    periodicidadeDias: 90,
    clienteId: "",
    equipamentoId: "",
  });

  const { data: plans, refetch } = useQuery({
    queryKey: ["maintenance.listPlans"],
    queryFn: () => trpc.maintenance.listPlans.query({}),
  });

  const createMutation = useMutation({
    mutationFn: () => trpc.maintenance.createPlan.mutate(formData),
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setFormData({
        nomeEmpresa: "",
        tipoEquipamento: "ar-condicionado",
        periodicidadeDias: 90,
        clienteId: "",
        equipamentoId: "",
      });
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between">
        <h1 className="text-3xl font-bold">Planos de Manutenção</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Novo Plano
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border border-gray-300 rounded">
          <h2 className="font-bold mb-4">Criar Novo Plano</h2>
          <input
            type="text"
            placeholder="Nome da Empresa"
            value={formData.nomeEmpresa}
            onChange={(e) =>
              setFormData({ ...formData, nomeEmpresa: e.target.value })
            }
            className="w-full mb-2 p-2 border rounded"
          />
          <select
            value={formData.tipoEquipamento}
            onChange={(e) =>
              setFormData({ ...formData, tipoEquipamento: e.target.value })
            }
            className="w-full mb-2 p-2 border rounded"
          >
            <option value="ar-condicionado">Ar Condicionado</option>
            <option value="refrigerador">Refrigerador</option>
            <option value="freezer">Freezer</option>
            <option value="climatizador">Climatizador</option>
          </select>
          <input
            type="number"
            placeholder="Periodicidade (dias)"
            value={formData.periodicidadeDias}
            onChange={(e) =>
              setFormData({
                ...formData,
                periodicidadeDias: parseInt(e.target.value),
              })
            }
            className="w-full mb-2 p-2 border rounded"
          />
          <button
            onClick={() => createMutation.mutate()}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Salvar
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {plans?.data?.map((plan: any) => (
          <div key={plan.id} className="p-4 border border-gray-200 rounded">
            <h3 className="font-bold text-lg">{plan.nomeEmpresa}</h3>
            <p className="text-sm text-gray-600">
              {plan.tipoEquipamento} - {plan.periodicidadeDias} dias
            </p>
            <p className="text-xs text-gray-500 mt-2">Próxima: {plan.proxima}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
