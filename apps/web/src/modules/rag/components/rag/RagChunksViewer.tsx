import { Box } from "@repo/ui-mui/layout/Box";
import { Typography } from "@repo/ui-mui/data-display/Typography";
import { Chip } from "@repo/ui-mui/form/Chip";
import { Divider } from "@repo/ui-mui/components/Divider";
import { FileTextIcon } from "@repo/ui-mui/icons/FileTextIcon";
import { StarIcon } from "@repo/ui-mui/icons/StarIcon";

interface TrieveChunk {
	id: string;
	content: string;
	metadata: Record<string, string>;
}

interface SearchResult {
	id: string;
	score: number;
	chunk: TrieveChunk;
}

interface RagChunksViewerProps {
	chunks: SearchResult[];
}

export function RagChunksViewer({ chunks }: RagChunksViewerProps) {
	return (
		<Box sx={{ mt: 4 }}>
			{/* Header */}
			<Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
				<Typography
					variant="h5"
					sx={{
						fontWeight: 600,
						color: "text.primary",
					}}
				>
					Chunks Retrieved
				</Typography>
				<Chip
					label={`${chunks.length} resultados`}
					size="small"
					color="primary"
					variant="outlined"
				/>
			</Box>

			{/* Chunks List */}
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					gap: 3,
				}}
			>
				{chunks.map((result, index) => (
					<Box
						key={result.id}
						sx={{
							bgcolor: "background.paper",
							borderRadius: 2,
							p: { xs: 3, md: 4 },
							boxShadow: 1,
							border: "1px solid",
							borderColor: "divider",
							transition: "all 0.2s ease-in-out",
							"&:hover": {
								boxShadow: 2,
								borderColor: "primary.light",
							},
						}}
					>
						{/* Chunk Header */}
						<Box
							sx={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "flex-start",
								mb: 2,
								gap: 2,
							}}
						>
							<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
								<FileTextIcon sx={{ color: "primary.main", fontSize: 20 }} />
								<Box>
									<Typography variant="subtitle2" fontWeight={600} color="text.primary">
										Chunk #{index + 1}
									</Typography>
									{result.chunk.metadata?.source && (
										<Typography variant="caption" color="text.secondary">
											{result.chunk.metadata.source}
										</Typography>
									)}
								</Box>
							</Box>

							{/* Relevance Score */}
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 0.5,
									bgcolor:
										result.score >= 0.8
											? "success.light"
											: result.score >= 0.6
												? "warning.light"
												: "error.light",
									px: 1.5,
									py: 0.5,
									borderRadius: 1,
								}}
							>
								<StarIcon sx={{ fontSize: 14 }} />
								<Typography
									variant="caption"
									sx={{
										fontWeight: 600,
										color:
											result.score >= 0.8
												? "success.dark"
												: result.score >= 0.6
													? "warning.dark"
													: "error.dark",
									}}
								>
									{(result.score * 100).toFixed(0)}%
								</Typography>
							</Box>
						</Box>

						{/* Chunk Content */}
						<Box
							sx={{
								bgcolor: "background.default",
								borderRadius: 1,
								p: 2,
								mb: 2,
							}}
						>
							<Typography
								variant="body2"
								sx={{
									whiteSpace: "pre-wrap",
									fontFamily: "monospace",
									fontSize: "0.875rem",
									lineHeight: 1.6,
									color: "text.primary",
								}}
							>
								{result.chunk.content}
							</Typography>
						</Box>

						{/* Metadata */}
						{result.chunk.metadata && Object.keys(result.chunk.metadata).length > 0 && (
							<>
								<Divider sx={{ my: 2 }} />
								<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
									{Object.entries(result.chunk.metadata).map(([key, value]) => (
										<Chip
											key={key}
											label={`${key}: ${value}`}
											size="small"
											variant="outlined"
											sx={{
												fontSize: "0.75rem",
												height: 24,
											}}
										/>
									))}
								</Box>
							</>
						)}
					</Box>
				))}
			</Box>
		</Box>
	);
}