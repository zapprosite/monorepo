import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Box } from "@repo/ui-mui/layout/Box";
import { Container } from "@repo/ui-mui/layout/Container";
import { CreateJournalEntryForm } from "@frontend/components/CreateJournalEntryForm";

export default function CreateJournalEntryPage() {
	return (
		<Container maxWidth="md" sx={{ py: 4 }}>
			<Box sx={{ mb: 4 }}>
				<Typography variant="h4" component="h1" gutterBottom>
					Nova entrada no diário
				</Typography>
				<Typography variant="body1" color="text.secondary">
					Escreva seus pensamentos e reflexões
				</Typography>
			</Box>
			<CreateJournalEntryForm />
		</Container>
	);
}
