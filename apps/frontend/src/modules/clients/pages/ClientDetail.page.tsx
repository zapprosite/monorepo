import { ErrorAlert } from "@connected-repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";
import { lazy, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AddressModal } from "../components/AddressModal";
import { ContactModal } from "../components/ContactModal";

// Lazy cross-module imports (equipment module)
const AddEquipmentModal = lazy(() =>
	import("@frontend/modules/equipment/components/AddEquipmentModal").then((m) => ({
		default: m.AddEquipmentModal,
	})),
);
const EquipmentStatusBadge = lazy(() =>
	import("@frontend/modules/equipment/components/EquipmentStatusBadge").then((m) => ({
		default: m.EquipmentStatusBadge,
	})),
);
const UnitModal = lazy(() =>
	import("@frontend/modules/equipment/components/UnitModal").then((m) => ({
		default: m.UnitModal,
	})),
);

export default function ClientDetailPage() {
	const { clientId } = useParams<{ clientId: string }>();
	const navigate = useNavigate();
	const [contactModalOpen, setContactModalOpen] = useState(false);
	const [addressModalOpen, setAddressModalOpen] = useState(false);
	const [unitModalOpen, setUnitModalOpen] = useState(false);
	const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);

	const {
		data: client,
		isLoading,
		error,
	} = useQuery(trpc.clients.getClientDetail.queryOptions({ clientId: clientId! }));
	const { data: contacts } = useQuery(
		trpc.clients.listContacts.queryOptions({ clienteId: clientId! }),
	);
	const { data: addresses } = useQuery(
		trpc.clients.listAddresses.queryOptions({ clienteId: clientId! }),
	);
	const { data: units } = useQuery(
		trpc.equipment.listUnitsByClient.queryOptions({ clienteId: clientId! }),
	);
	const { data: equipmentList } = useQuery(
		trpc.equipment.listEquipmentByClient.queryOptions({ clienteId: clientId! }),
	);

	if (isLoading) return <LoadingSpinner text="Carregando cliente..." />;

	if (error || !client) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert
					message={`Erro ao carregar cliente: ${error?.message ?? "Cliente não encontrado"}`}
				/>
			</Container>
		);
	}

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
			<Box sx={{ mb: 4 }}>
				<Button
					variant="text"
					size="small"
					onClick={() => navigate("/clients")}
					sx={{ mb: 1, color: "text.secondary" }}
				>
					← Voltar para Clientes
				</Button>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
					<Typography variant="h4" fontWeight={700}>
						{client.nome}
					</Typography>
					<Chip label={client.tipo} variant="outlined" />
					{!client.ativo && <Chip label="Inativo" color="default" size="small" />}
				</Box>
			</Box>

			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
				{/* Info */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Typography variant="h6" fontWeight={600} mb={2}>
						Informações
					</Typography>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						{client.email && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Email
								</Typography>
								<Typography variant="body2">{client.email}</Typography>
							</Box>
						)}
						{client.telefone && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									Telefone
								</Typography>
								<Typography variant="body2">{client.telefone}</Typography>
							</Box>
						)}
						{client.cpfCnpj && (
							<Box>
								<Typography variant="caption" color="text.secondary">
									CPF/CNPJ
								</Typography>
								<Typography variant="body2">{client.cpfCnpj}</Typography>
							</Box>
						)}
					</Box>
				</Paper>

				{/* Contacts */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Box
						sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}
					>
						<Typography variant="h6" fontWeight={600}>
							Contatos
						</Typography>
						<Button size="small" variant="outlined" onClick={() => setContactModalOpen(true)}>
							+ Adicionar
						</Button>
					</Box>
					{!contacts || contacts.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							Nenhum contato cadastrado
						</Typography>
					) : (
						<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
							{contacts.map((c) => (
								<Box
									key={c.contactId}
									sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
								>
									<Box>
										<Typography variant="body2" fontWeight={500}>
											{c.nome}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{c.cargo} {c.email ? `· ${c.email}` : ""}
										</Typography>
									</Box>
									{c.isPrimary && <Chip label="Principal" size="small" color="primary" />}
								</Box>
							))}
						</Box>
					)}
				</Paper>

				{/* Addresses */}
				<Paper
					elevation={0}
					sx={{
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 2,
						p: 3,
						gridColumn: { md: "1 / -1" },
					}}
				>
					<Box
						sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}
					>
						<Typography variant="h6" fontWeight={600}>
							Endereços
						</Typography>
						<Button size="small" variant="outlined" onClick={() => setAddressModalOpen(true)}>
							+ Adicionar
						</Button>
					</Box>
					{!addresses || addresses.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							Nenhum endereço cadastrado
						</Typography>
					) : (
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
								gap: 2,
							}}
						>
							{addresses.map((a) => (
								<Box
									key={a.addressId}
									sx={{
										p: 2,
										border: "1px solid",
										borderColor: "divider",
										borderRadius: 1.5,
									}}
								>
									{a.tipo && <Chip label={a.tipo} size="small" sx={{ mb: 1 }} />}
									<Typography variant="body2">
										{a.rua}, {a.numero}
										{a.complemento ? ` - ${a.complemento}` : ""}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{a.bairro} · {a.cidade}/{a.estado} · {a.cep}
									</Typography>
								</Box>
							))}
						</Box>
					)}
				</Paper>

				{/* Units */}
				<Paper
					elevation={0}
					sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}
				>
					<Box
						sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}
					>
						<Typography variant="h6" fontWeight={600}>
							Unidades
						</Typography>
						<Button size="small" variant="outlined" onClick={() => setUnitModalOpen(true)}>
							+ Adicionar
						</Button>
					</Box>
					{!units || units.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							Nenhuma unidade cadastrada
						</Typography>
					) : (
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
								gap: 2,
							}}
						>
							{units.map((u) => (
								<Box
									key={u.unitId}
									sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											mb: 0.5,
										}}
									>
										<Typography variant="body2" fontWeight={500}>
											{u.nome}
										</Typography>
										<Chip
											label={u.ativa ? "Ativa" : "Inativa"}
											color={u.ativa ? "success" : "default"}
											size="small"
										/>
									</Box>
									{(u.cidade || u.estado) && (
										<Typography variant="caption" color="text.secondary">
											{[u.cidade, u.estado].filter(Boolean).join("/")}
										</Typography>
									)}
								</Box>
							))}
						</Box>
					)}
				</Paper>

				{/* Equipment */}
				<Paper
					elevation={0}
					sx={{
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 2,
						p: 3,
						gridColumn: { md: "1 / -1" },
					}}
				>
					<Box
						sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}
					>
						<Typography variant="h6" fontWeight={600}>
							Equipamentos
						</Typography>
						<Button size="small" variant="outlined" onClick={() => setEquipmentModalOpen(true)}>
							+ Adicionar
						</Button>
					</Box>
					{!equipmentList || equipmentList.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							Nenhum equipamento cadastrado
						</Typography>
					) : (
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
								gap: 2,
							}}
						>
							{equipmentList.map((eq) => (
								<Box
									key={eq.equipmentId}
									sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											mb: 0.5,
										}}
									>
										<Typography variant="body2" fontWeight={500}>
											{eq.nome}
										</Typography>
										<EquipmentStatusBadge status={eq.status} />
									</Box>
									<Typography variant="caption" color="text.secondary">
										{eq.tipo}
										{eq.unitId && units?.find((u) => u.unitId === eq.unitId)
											? ` · ${units.find((u) => u.unitId === eq.unitId)?.nome}`
											: ""}
									</Typography>
								</Box>
							))}
						</Box>
					)}
				</Paper>
			</Box>

			<ContactModal
				clienteId={clientId!}
				open={contactModalOpen}
				onClose={() => setContactModalOpen(false)}
			/>
			<AddressModal
				clienteId={clientId!}
				open={addressModalOpen}
				onClose={() => setAddressModalOpen(false)}
			/>
			<UnitModal
				clienteId={clientId!}
				open={unitModalOpen}
				onClose={() => setUnitModalOpen(false)}
			/>
			<AddEquipmentModal
				clienteId={clientId!}
				open={equipmentModalOpen}
				onClose={() => setEquipmentModalOpen(false)}
			/>
		</Container>
	);
}
