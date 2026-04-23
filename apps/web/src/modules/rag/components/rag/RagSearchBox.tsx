import { useState } from "react";
import { Box } from "@repo/ui-mui/layout/Box";
import { TextField } from "@repo/ui-mui/form/TextField";
import { Button } from "@repo/ui-mui/form/Button";
import { Select } from "@repo/ui-mui/form/Select";
import { MenuItem } from "@mui/material";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { SearchIcon } from "@repo/ui-mui/icons/SearchIcon";
import { CircularProgress } from "@repo/ui-mui/feedback/CircularProgress";

interface Dataset {
	id: string;
	name: string;
	description: string;
}

interface RagSearchBoxProps {
	datasets: Dataset[];
	onSearch: (query: string, datasetId: string) => void;
	isSearching: boolean;
}

export function RagSearchBox({ datasets, onSearch, isSearching }: RagSearchBoxProps) {
	const [query, setQuery] = useState("");
	const [selectedDatasetId, setSelectedDatasetId] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (query.trim() && selectedDatasetId) {
			onSearch(query.trim(), selectedDatasetId);
		}
	};

	const isDisabled = !query.trim() || !selectedDatasetId || isSearching;

	return (
		<Box
			component="form"
			onSubmit={handleSubmit}
			sx={{
				bgcolor: "background.paper",
				borderRadius: 2,
				p: { xs: 3, md: 4 },
				boxShadow: 1,
				mb: 4,
			}}
		>
			{/* Dataset Selection */}
			<Box sx={{ mb: 3 }}>
				<Typography
					variant="subtitle2"
					sx={{
						fontWeight: 600,
						mb: 1,
						color: "text.primary",
					}}
				>
				 Dataset
				</Typography>
				<Select
					value={selectedDatasetId}
					onChange={(e) => setSelectedDatasetId(e.target.value)}
					displayEmpty
					sx={{
						width: "100%",
						bgcolor: "background.default",
					}}
				>
					<MenuItem value="" disabled>
						<Typography variant="body2" color="text.disabled">
							Selecione um dataset...
						</Typography>
					</MenuItem>
					{datasets.map((dataset) => (
						<MenuItem key={dataset.id} value={dataset.id}>
							<Box>
								<Typography variant="body2" fontWeight={500}>
									{dataset.name}
								</Typography>
								{dataset.description && (
									<Typography variant="caption" color="text.secondary">
										{dataset.description}
									</Typography>
								)}
							</Box>
						</MenuItem>
					))}
				</Select>
			</Box>

			{/* Search Input */}
			<Box sx={{ mb: 3 }}>
				<Typography
					variant="subtitle2"
					sx={{
						fontWeight: 600,
						mb: 1,
						color: "text.primary",
					}}
				>
					Query
				</Typography>
				<TextField
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Digite sua busca semântica..."
					fullWidth
					disabled={isSearching}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !isDisabled) {
							handleSubmit(e);
						}
					}}
					InputProps={{
						startAdornment: (
							<Box sx={{ color: "text.secondary", mr: 1, display: "flex" }}>
								<SearchIcon sx={{ fontSize: 20 }} />
							</Box>
						),
					}}
				/>
			</Box>

			{/* Submit Button */}
			<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
				<Button
					type="submit"
					variant="contained"
					disabled={isDisabled}
					startIcon={
						isSearching ? (
							<CircularProgress size={18} color="inherit" />
						) : (
							<SearchIcon sx={{ fontSize: 20 }} />
						)
					}
					sx={{
						px: { xs: 3, md: 4 },
						py: 1.5,
						fontWeight: 600,
						textTransform: "none",
						boxShadow: 2,
						"&:hover": {
							boxShadow: 3,
						},
					}}
				>
					{isSearching ? "Buscando..." : "Buscar"}
				</Button>
			</Box>
		</Box>
	);
}