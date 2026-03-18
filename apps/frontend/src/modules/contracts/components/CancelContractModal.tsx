import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Dialog } from "@connected-repo/ui-mui/feedback/Dialog";
import { DialogActions } from "@connected-repo/ui-mui/feedback/DialogActions";
import { DialogContent } from "@connected-repo/ui-mui/feedback/DialogContent";
import { DialogTitle } from "@connected-repo/ui-mui/feedback/DialogTitle";
import { trpc } from "@frontend/utils/trpc.client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface CancelContractModalProps {
	open: boolean;
	onClose: () => void;
	contractId: string;
	onSuccess: () => void;
}

export function CancelContractModal({ open, onClose, contractId, onSuccess }: CancelContractModalProps) {
	const [motivoCancelamento, setMotivoCancelamento] = useState("");
	const queryClient = useQueryClient();

	const cancelContract = useMutation(
		trpc.contracts.cancelContract.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.contracts.listContracts.queryKey() });
				queryClient.invalidateQueries({
					queryKey: trpc.contracts.getContractDetail.queryKey({ contractId }),
				});
				setMotivoCancelamento("");
				onSuccess();
			},
		}),
	);

	const handleClose = () => {
		setMotivoCancelamento("");
		onClose();
	};

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
			<DialogTitle>Cancelar Contrato</DialogTitle>
			<DialogContent>
				<Typography variant="body2" color="text.secondary" mb={2}>
					Informe o motivo do cancelamento. Esta ação não pode ser desfeita.
				</Typography>
				<TextField
					label="Motivo do cancelamento"
					multiline
					rows={3}
					fullWidth
					value={motivoCancelamento}
					onChange={(e) => setMotivoCancelamento(e.target.value)}
				/>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose} variant="outlined" disabled={cancelContract.isPending}>
					Voltar
				</Button>
				<Button
					variant="contained"
					color="error"
					disabled={cancelContract.isPending}
					onClick={() =>
						cancelContract.mutate({
							contractId,
							motivoCancelamento: motivoCancelamento || undefined,
						})
					}
				>
					{cancelContract.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
