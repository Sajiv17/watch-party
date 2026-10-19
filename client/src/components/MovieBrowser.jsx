import { useState, useEffect } from 'react';
import {
  getPopularMovies,
  getTopRatedMovies,
  getNowPlayingMovies,
  searchMovies,
  getGenres,
  discoverMovies,
  getMovieVideos,
  getPosterUrl
} from '../utils/tmdb';

/**
 * MovieBrowser component for discovering and selecting movies
 * Features: categories, filters, fuzzy search, trailer playback
 */
function MovieBrowser({ onPlayTrailer, onAddToPlaylist }) {
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [category, setCategory] = useState('popular');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [minRating, setMinRating] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const data = await getGenres();
        setGenres(data.genres || []);
      } catch (err) {
        console.error('Failed to fetch genres:', err);
      }
    };
    fetchGenres();
  }, []);

  // Fetch movies based on category and filters
  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      setError('');

      try {
        let data;

        if (selectedGenre || selectedYear || minRating) {
          // Use discover API with filters
          data = await discoverMovies({
            genre: selectedGenre,
            year: selectedYear,
            minRating: minRating
          });
        } else {
          // Use category endpoints
          switch (category) {
            case 'popular':
              data = await getPopularMovies();
              break;
            case 'top_rated':
              data = await getTopRatedMovies();
              break;
            case 'now_playing':
              data = await getNowPlayingMovies();
              break;
            default:
              data = await getPopularMovies();
          }
        }

        setMovies(data.results || []);
      } catch (err) {
        setError('Failed to load movies. Check your TMDB API key in .env');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [category, selectedGenre, selectedYear, minRating]);

  // Real TMDB search (not fuzzy search on local movies)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Debounce search - wait 500ms after user stops typing
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setError('');

      try {
        const data = await searchMovies(searchQuery);
        setSearchResults(data.results || []);
      } catch (err) {
        setError('Search failed. Please try again.');
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Display search results if searching, otherwise show category movies
  const displayMovies = searchQuery.trim() ? searchResults : movies;
  const showLoading = searchQuery.trim() ? isSearching : loading;

  // Handle play trailer
  const handlePlayTrailer = async (movie) => {
    try {
      const videos = await getMovieVideos(movie.id);
      if (videos.length > 0) {
        const trailer = videos[0]; // First YouTube trailer
        onPlayTrailer(trailer.key, movie);
      } else {
        alert('No trailer available for this movie');
      }
    } catch (err) {
      alert('Failed to load trailer');
      console.error(err);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Movie Browser</h2>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search movies..."
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <button
          onClick={() => setCategory('popular')}
          className={`px-4 py-2 rounded whitespace-nowrap ${
            category === 'popular' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          Popular
        </button>
        <button
          onClick={() => setCategory('top_rated')}
          className={`px-4 py-2 rounded whitespace-nowrap ${
            category === 'top_rated' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          Top Rated
        </button>
        <button
          onClick={() => setCategory('now_playing')}
          className={`px-4 py-2 rounded whitespace-nowrap ${
            category === 'now_playing' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          Now Playing
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Genres</option>
          {genres.map(genre => (
            <option key={genre.id} value={genre.id}>{genre.name}</option>
          ))}
        </select>

        <input
          type="number"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          placeholder="Year"
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        <input
          type="number"
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
          placeholder="Min Rating"
          min="0"
          max="10"
          step="0.5"
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Clear Filters */}
      {(selectedGenre || selectedYear || minRating) && (
        <button
          onClick={() => {
            setSelectedGenre('');
            setSelectedYear('');
            setMinRating('');
          }}
          className="text-sm text-purple-400 hover:text-purple-300 mb-4"
        >
          Clear Filters
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {showLoading && (
        <div className="text-center py-8 text-gray-400">
          {searchQuery.trim() ? 'Searching...' : 'Loading movies...'}
        </div>
      )}

      {/* Movies Grid */}
      {!showLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {displayMovies.map(movie => (
            <div key={movie.id} className="bg-gray-700 rounded overflow-hidden">
              {movie.poster_path ? (
                <img
                  src={getPosterUrl(movie.poster_path, 'w342')}
                  alt={movie.title}
                  className="w-full aspect-[2/3] object-cover"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-600 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No Image</span>
                </div>
              )}

              <div className="p-2">
                <h3 className="font-semibold text-sm truncate" title={movie.title}>
                  {movie.title}
                </h3>
                <p className="text-xs text-gray-400">
                  {movie.release_date?.substring(0, 4) || 'N/A'} • ⭐ {movie.vote_average?.toFixed(1) || 'N/A'}
                </p>

                <div className="flex flex-col gap-1 mt-2">
                  <button
                    onClick={() => handlePlayTrailer(movie)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-xs py-1.5 rounded font-medium"
                  >
                    Play Trailer
                  </button>
                  <button
                    onClick={() => onAddToPlaylist(movie)}
                    className="w-full bg-green-600 hover:bg-green-700 text-xs py-1.5 rounded font-medium"
                  >
                    + Add to Playlist
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showLoading && displayMovies.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          {searchQuery.trim()
            ? `No results for "${searchQuery}"`
            : 'No movies found'}
        </div>
      )}
    </div>
  );
}

export default MovieBrowser;
