import React from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@frontend/utils/trpc";

export const LoyaltyDashboardPage: React.FC = () => {
  const { data: scores } = useQuery({
    queryKey: ["loyalty.listLoyalty"],
    queryFn: () =>
      trpc.loyalty.listLoyalty.query({
        limit: 50,
        offset: 0,
      }),
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "bronze":
        return "bg-orange-100";
      case "prata":
        return "bg-gray-100";
      case "ouro":
        return "bg-yellow-100";
      case "platinum":
        return "bg-purple-100";
      default:
        return "bg-gray-50";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ativo: "✅ Ativo",
      "risco-30d": "⚠️ Risco 30d",
      "risco-60d": "⚠️ Risco 60d",
      "risco-90d": "🔴 Risco 90d",
      perdido: "❌ Perdido",
    };
    return labels[status] || status;
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard de Fidelização</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-600">Total de Clientes</p>
          <p className="text-2xl font-bold">{scores?.data?.length || 0}</p>
        </div>
        <div className="p-4 bg-green-50 rounded">
          <p className="text-sm text-gray-600">Nível Platinum</p>
          <p className="text-2xl font-bold">
            {scores?.data?.filter((s: any) => s.nivel === "platinum").length || 0}
          </p>
        </div>
        <div className="p-4 bg-yellow-50 rounded">
          <p className="text-sm text-gray-600">Em Risco</p>
          <p className="text-2xl font-bold">
            {scores?.data?.filter((s: any) => s.statusReativacao.includes("risco")).length || 0}
          </p>
        </div>
        <div className="p-4 bg-red-50 rounded">
          <p className="text-sm text-gray-600">Perdidos</p>
          <p className="text-2xl font-bold">
            {scores?.data?.filter((s: any) => s.statusReativacao === "perdido").length || 0}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {scores?.data?.map((score: any) => (
          <div
            key={score.clienteId}
            className={`p-4 rounded ${getLevelColor(score.nivel)}`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold">Cliente ID: {score.clienteId.slice(0, 8)}</p>
                <p className="text-sm">
                  Pontos: {score.pontos} | Nível: {score.nivel.toUpperCase()}
                </p>
              </div>
              <span className="text-lg">{getStatusLabel(score.statusReativacao)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
