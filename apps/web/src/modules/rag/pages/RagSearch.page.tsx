import { useState } from "react";
import { Box } from "@repo/ui-mui/layout/Box";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Container } from "@repo/ui-mui/layout/Container";
import { LoadingSpinner } from "@repo/ui-mui/components/LoadingSpinner";
import { ErrorAlert } from "@repo/ui-mui/components/ErrorAlert";
import { RagSearchBox } from "../../components/rag/RagSearchBox";
import { RagChunksViewer } from "../../components/rag/RagChunksViewer";
import { trpc } from "@frontend/utils/trpc.client";
import { useQuery } from "@tanstack/react-query";

export default function RagSearchPage() {
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [selectedDataset, setSelectedDataset] = useState<string>("");

	const {
		data: datasets,
		isLoading: datasetsLoading,
		error: datasetsError,
	} = useQuery(trpc.trieve.listDatasets.queryOptions());

	const {
		data: searchResults,
		isLoading: searchLoading,
		error: searchError,
	} = useQuery(
		trpc.trieve.search.queryOptions({
			query: searchQuery,
			datasetId: selectedDataset,
			limit: 10,
		}),
		{ enabled: searchQuery.length > 0 && selectedDataset.length > 0 }
	);

	const handleSearch = (query: string, datasetId: string) => {
		setSearchQuery(query);
		setSelectedDataset(datasetId);
	};

	if (datasetsLoading) {
		return <LoadingSpinner text="Carregando datasets..." />;
	}

	if (datasetsError) {
		const errorMessage = datasetsError.data?.userFriendlyMessage || datasetsError.message;
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<ErrorAlert message={`Erro ao carregar datasets: ${errorMessage}`} />
			</Container>
		);
	}

	return (
		<Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
			{/* Header Section */}
			<Box sx={{ mb: 5 }}>
				<Typography
					variant="h3"
					component="h1"
					sx={{
						fontSize: { xs: "2rem", md: "2.5rem" },
						fontWeight: 700,
						color: "text.primary",
						mb: 1,
						letterSpacing: "-0.01em",
					}}
				>
					RAG Search
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
					Busca semântica em documentos indexados via Trieve
				</Typography>
			</Box>

			{/* Search Component */}
			<RagSearchBox
				datasets={datasets ?? []}
				onSearch={handleSearch}
				isSearching={searchLoading}
			/>

			{/* Results Section */}
			{searchLoading && (
				<Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
					<LoadingSpinner text="Buscando chunks relevantes..." />
				</Box>
			)}

			{searchError && (
				<Box sx={{ py: 4 }}>
					<ErrorAlert
						message={`Erro na busca: ${searchError.data?.userFriendlyMessage || searchError.message}`}
					/>
				</Box>
			)}

			{searchResults && searchResults.length > 0 && (
				<RagChunksViewer chunks={searchResults} />
			)}

			{searchResults && searchResults.length === 0 && searchQuery.length > 0 && (
				<Box sx={{ py: 8, textAlign: "center" }}>
					<Typography variant="h6" color="text.secondary">
						Nenhum resultado encontrado para "{searchQuery}"
					</Typography>
					<Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
						Tente ajustar sua busca ou selecionar outro dataset
					</Typography>
				</Box>
			)}
		</Container>
	);
}