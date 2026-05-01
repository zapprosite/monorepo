import { ErrorAlert } from "@repo/ui-mui/components/ErrorAlert";
import { LoadingSpinner } from "@repo/ui-mui/components/LoadingSpinner";
import { List, ListItem } from "@repo/ui-mui/data-display/List";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Box } from "@repo/ui-mui/layout/Box";
import { Card, CardContent } from "@repo/ui-mui/layout/Card";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";

export function JournalEntryList() {
	const {
		data: journalEntries,
		isLoading,
		error,
	} = useQuery(trpc.journalEntries.getAll.queryOptions());

	if (isLoading) return <LoadingSpinner text="Carregando entradas do diário..." />;

	if (error) {
		const errorMessage = error.data?.userFriendlyMessage || error.message;
		return <ErrorAlert message={`Erro ao carregar entradas do diário: ${errorMessage}`} />;
	}

	return (
		<Box sx={{ mt: 3 }}>
			<Typography variant="h5" component="h2" gutterBottom>
				Entradas do diário
			</Typography>
			{journalEntries && journalEntries.length > 0 ? (
				<List sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{journalEntries.map((entry) => (
						<ListItem key={entry.journalEntryId} sx={{ p: 0 }}>
							<Card sx={{ width: "100%", border: "1px solid", borderColor: "divider" }}>
								<CardContent>
									<Typography variant="h6" component="h3" gutterBottom color="primary">
										{entry.prompt}
									</Typography>
									<Typography variant="body1" paragraph>
										{entry.content}
									</Typography>
									<Box sx={{ mt: 1.5 }}>
										<Typography variant="body2" color="text.secondary">
											Por: {entry.author?.name} ({entry.author?.email})
										</Typography>
										<Typography variant="body2" color="text.secondary">
											Criado em: {new Date(entry.createdAt).toLocaleDateString()}
										</Typography>
									</Box>
								</CardContent>
							</Card>
						</ListItem>
					))}
				</List>
			) : (
				<Typography variant="body1" color="text.secondary">
					Nenhuma entrada do diário encontrada. Comece escrevendo sua primeira entrada!
				</Typography>
			)}
		</Box>
	);
}
