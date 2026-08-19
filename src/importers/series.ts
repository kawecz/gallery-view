import { requestUrl } from "obsidian";
import type { TMDBSeries } from "../types";

export interface SeriesMetadata {
    title: string;
    creator: string;
    year: string;
    genres: string;
    coverUrl: string;
    description: string;
    rating: string;
    tmdbId: string;
    seasons: string;
}

export async function searchTMDBSeries(
    query: string,
    apiKey: string,
): Promise<SeriesMetadata[]> {
    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
    const response = await requestUrl({ url: searchUrl });

    if (response.status !== 200) {
        throw new Error("Failed to search TMDB");
    }

    const data = response.json as { results: TMDBSeries[] };

    // Fetch full details for each search result to get genres and creator
    const results: SeriesMetadata[] = [];
    for (const series of data.results.slice(0, 5)) {
        const details = await fetchSeriesDetails(
            series.id.toString(),
            apiKey,
        );
        if (details) {
            results.push(details);
        }
    }

    return results;
}

export async function fetchSeriesDetails(
    seriesId: string,
    apiKey: string,
): Promise<SeriesMetadata | null> {
    const url = `https://api.themoviedb.org/3/tv/${seriesId}?api_key=${apiKey}&append_to_response=credits`;
    const response = await requestUrl({ url });

    if (response.status !== 200) return null;

    const series = response.json as TMDBSeries & {
        created_by?: { name: string }[];
        genres?: { id: number; name: string }[];
        number_of_seasons?: number;
    };

    const creator =
        series.created_by?.map((c) => c.name).join(", ") || "";

    const genres = series.genres?.map((g) => g.name).join(", ") || "";

    return {
        title: series.name,
        creator,
        year: series.first_air_date
            ? series.first_air_date.substring(0, 4)
            : "",
        genres,
        coverUrl: series.poster_path
            ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
            : "",
        description: series.overview || "",
        rating: series.vote_average?.toString() || "",
        tmdbId: series.id.toString(),
        seasons: series.number_of_seasons?.toString() || "",
    };
}