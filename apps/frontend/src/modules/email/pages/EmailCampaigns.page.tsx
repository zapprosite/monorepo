import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "@frontend/utils/trpc";

export const EmailCampaignsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    tipoCampanha: "marketing" as const,
    destinatariosJSON: [] as string[],
  });

  const { data: campaigns, refetch } = useQuery({
    queryKey: ["email.listCampaigns"],
    queryFn: () =>
      trpc.email.listCampaigns.query({
        limit: 50,
        offset: 0,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () => trpc.email.createCampaign.mutate(formData),
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setFormData({
        nome: "",
        tipoCampanha: "marketing",
        destinatariosJSON: [],
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      rascunho: "bg-gray-100 text-gray-800",
      agendada: "bg-blue-100 text-blue-800",
      enviando: "bg-yellow-100 text-yellow-800",
      enviada: "bg-green-100 text-green-800",
      cancelada: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100";
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between">
        <h1 className="text-3xl font-bold">Campanhas de Email</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Nova Campanha
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border border-gray-300 rounded">
          <h2 className="font-bold mb-4">Criar Nova Campanha</h2>
          <input
            type="text"
            placeholder="Nome da Campanha"
            value={formData.nome}
            onChange={(e) =>
              setFormData({ ...formData, nome: e.target.value })
            }
            className="w-full mb-2 p-2 border rounded"
          />
          <select
            value={formData.tipoCampanha}
            onChange={(e) =>
              setFormData({
                ...formData,
                tipoCampanha: e.target.value as any,
              })
            }
            className="w-full mb-2 p-2 border rounded"
          >
            <option value="marketing">Marketing</option>
            <option value="reativacao">Reativação</option>
            <option value="newsletter">Newsletter</option>
            <option value="promocional">Promocional</option>
            <option value="transacional">Transacional</option>
          </select>
          <button
            onClick={() => createMutation.mutate()}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Salvar
          </button>
        </div>
      )}

      <div className="space-y-2">
        {campaigns?.data?.map((campaign: any) => (
          <div key={campaign.id} className="p-4 border border-gray-200 rounded">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">{campaign.nome}</h3>
                <p className="text-sm text-gray-600">
                  {campaign.tipoCampanha} | {campaign.totalEnviado} enviados
                </p>
                {campaign.totalEnviado > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Taxa de abertura: {campaign.taxaAberturaPercent?.toFixed(1) || 0}%
                  </p>
                )}
              </div>
              <span className={`px-3 py-1 rounded text-sm ${getStatusBadge(campaign.statusCampanha)}`}>
                {campaign.statusCampanha}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
