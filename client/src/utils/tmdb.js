// TMDB API helper functions
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/**
 * Fetch popular movies
 */
export async function getPopularMovies(page = 1) {
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=${page}`
  );
  if (!response.ok) throw new Error('Failed to fetch popular movies');
  return response.json();
}

/**
 * Fetch top rated movies
 */
export async function getTopRatedMovies(page = 1) {
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`
  );
  if (!response.ok) throw new Error('Failed to fetch top rated movies');
  return response.json();
}

/**
 * Fetch now playing movies
 */
export async function getNowPlayingMovies(page = 1) {
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&page=${page}`
  );
  if (!response.ok) throw new Error('Failed to fetch now playing movies');
  return response.json();
}

/**
 * Fetch movie genres
 */
export async function getGenres() {
  const response = await fetch(
    `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`
  );
  if (!response.ok) throw new Error('Failed to fetch genres');
  return response.json();
}

/**
 * Search movies by query
 */
export async function searchMovies(query, page = 1) {
  const response = await fetch(
    `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
  );
  if (!response.ok) throw new Error('Failed to search movies');
  return response.json();
}

/**
 * Discover movies with filters
 */
export async function discoverMovies(filters = {}) {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    page: filters.page || 1,
    sort_by: filters.sortBy || 'popularity.desc'
  });

  if (filters.genre) params.append('with_genres', filters.genre);
  if (filters.year) params.append('primary_release_year', filters.year);
  if (filters.minRating) params.append('vote_average.gte', filters.minRating);

  const response = await fetch(`${TMDB_BASE_URL}/discover/movie?${params}`);
  if (!response.ok) throw new Error('Failed to discover movies');
  return response.json();
}

/**
 * Get movie videos (trailers, teasers, etc.)
 */
export async function getMovieVideos(movieId) {
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`
  );
  if (!response.ok) throw new Error('Failed to fetch movie videos');
  const data = await response.json();

  // Filter for YouTube trailers
  const youtubeTrailers = data.results.filter(
    video => video.site === 'YouTube' && video.type === 'Trailer'
  );

  return youtubeTrailers;
}

/**
 * Get poster image URL
 */
export function getPosterUrl(path, size = 'w500') {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * Get backdrop image URL
 */
export function getBackdropUrl(path, size = 'w1280') {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
