import React, { useState } from 'react';
import { Search, Sparkles, User, Bot, Edit, Share, Plus, FileText, Code, Users, Upload, Loader2, Filter, Eye, Clock, Zap } from 'lucide-react';
import { SearchQuery, CandidateMatch, Candidate } from '../types';
import { extractEntities } from '../utils/searchUtils';
import { searchCandidatesWithStreaming } from '../utils/streamingSearch';
import CandidateTable from './CandidateTable';
import FilterModal from './FilterModal';
import { Project, getSearchResults } from '../lib/supabase';
import { convertDatabaseCandidatesToCandidates } from '../utils/dataConverters';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  extractedFilters?: any;
  searchQuery?: SearchQuery;
  isProcessing?: boolean;
  showSearchButton?: boolean;
  searchProgress?: {
    stage: string;
    current: number;
    total: number;
    message: string;
  };
}

interface SearchViewProps {
  onSearch: (query: SearchQuery) => void;
  matches: CandidateMatch[];
  isLoading: boolean;
  onSaveRecentSearch: (search: string) => void;
  recentSearches?: string[];
  candidates: Candidate[];
  currentProject?: Project | null;
}

const SearchView: React.FC<SearchViewProps> = ({ 
  onSearch, 
  matches, 
  isLoading, 
  onSaveRecentSearch,
  recentSearches = [],
  candidates,
  currentProject
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeSearchMethod, setActiveSearchMethod] = useState('natural');
  const [currentFilters, setCurrentFilters] = useState<any>(null);
  const [currentMatches, setCurrentMatches] = useState<CandidateMatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState<SearchQuery | null>(null);

  // Update current matches when matches prop changes
  React.useEffect(() => {
    if (matches && matches.length > 0) {
      setCurrentMatches(matches);
      setShowResults(true);
    }
  }, [matches]);

  const searchMethods = [
    { 
      id: 'natural', 
      label: 'Natural Language', 
      icon: Sparkles, 
      placeholder: 'Describe the candidate you\'re looking for...'
    },
    { 
      id: 'jd', 
      label: 'Job Description', 
      icon: FileText, 
      placeholder: 'Paste job description here...'
    },
    { 
      id: 'boolean', 
      label: 'Boolean Search', 
      icon: Code, 
      placeholder: 'Enter boolean search query...'
    },
    { 
      id: 'manual', 
      label: 'Advanced Filters', 
      icon: Users, 
      placeholder: 'Use advanced filters...'
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    console.log('🚀 Starting search process for query:', inputValue);

    // Save to recent searches
    onSaveRecentSearch(inputValue);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    // Add processing message with animated progress
    const processingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Analyzing your query with AI to extract search criteria...',
      timestamp: new Date(),
      isProcessing: true,
      searchProgress: {
        stage: 'extraction',
        current: 1,
        total: 3,
        message: 'Extracting entities from your query...'
      }
    };
    setMessages(prev => [...prev, processingMessage]);

    try {
      console.log('🔍 Starting AI entity extraction...');
      
      // Extract entities using AI
      const searchQuery = await extractEntities(inputValue);
      setCurrentSearchQuery(searchQuery);
      
      console.log('✅ Entity extraction completed:', searchQuery);
      
      // Create filters display object
      const filters = {
        jobTitles: searchQuery.extractedEntities.jobTitles,
        locations: searchQuery.extractedEntities.locations,
        experienceRange: searchQuery.extractedEntities.experienceRange,
        skills: searchQuery.extractedEntities.skills,
        industries: searchQuery.extractedEntities.industries,
        education: searchQuery.extractedEntities.education
      };

      setCurrentFilters(filters);

      // Remove processing message and add filter extraction result
      setMessages(prev => prev.filter(msg => !msg.isProcessing));
      
      const assistantMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        content: `Perfect! I've analyzed your query and extracted the search criteria below. These filters will be applied to narrow down from our database of ${candidates.length.toLocaleString()} candidates.`,
        timestamp: new Date(),
        extractedFilters: filters,
        searchQuery: searchQuery,
        showSearchButton: true
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      console.log('✅ Filter extraction UI updated');
      
    } catch (error) {
      console.error('❌ Filter extraction error:', error);
      
      // Remove processing message and show error
      setMessages(prev => prev.filter(msg => !msg.isProcessing));
      
      const errorMessage: Message = {
        id: (Date.now() + 3).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while analyzing your query. Please try again or check your API key configuration.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setInputValue('');
    }
  };

  const handleSearchCandidates = async (searchQuery: SearchQuery) => {
    if (!searchQuery || isSearching) return;

    console.log('🔍 Starting streaming candidate search...');
    console.log('📊 Search parameters:', searchQuery);

    setIsSearching(true);
    setCurrentMatches([]);
    
    // Add searching message with progress tracking
    const searchingMessage: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content: 'Searching through candidates with intelligent filtering and AI-powered matching...',
      timestamp: new Date(),
      isProcessing: true,
      searchProgress: {
        stage: 'searching',
        current: 2,
        total: 3,
        message: 'Applying smart filters and AI analysis...'
      }
    };
    setMessages(prev => [...prev, searchingMessage]);

    try {
      console.log('🤖 Starting streaming search with real-time updates...');
      
      // Use streaming search for real-time results
      await searchCandidatesWithStreaming(
        candidates, 
        searchQuery,
        (newMatches) => {
          console.log('📊 Received streaming update:', newMatches.length, 'total matches');
          setCurrentMatches(newMatches);
        }
      );

      console.log('✅ Streaming search completed');

      // Remove searching message and add results
      setMessages(prev => prev.filter(msg => !msg.isProcessing));
      
      const resultsMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `🎯 Search complete! Found candidates using intelligent filtering + AI analysis. Results are being displayed with real-time scoring.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, resultsMessage]);
      
      // Call the parent onSearch for any additional handling
      onSearch(searchQuery);
      
    } catch (error) {
      console.error('❌ Search error:', error);
      
      // Remove searching message and show error
      setMessages(prev => prev.filter(msg => !msg.isProcessing));
      
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while searching candidates. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewResults = () => {
    console.log('👀 Viewing results for', currentMatches.length, 'candidates');
    setShowResults(true);
  };

  const handleEditFilters = (filters: any) => {
    console.log('✏️ Editing filters:', filters);
    setCurrentFilters(filters);
    
    // Update the search query with new filters
    if (currentSearchQuery) {
      const updatedQuery: SearchQuery = {
        ...currentSearchQuery,
        extractedEntities: {
          jobTitles: filters.jobTitles || [],
          locations: filters.locations || [],
          experienceRange: filters.experienceRange || {},
          skills: filters.skills || [],
          industries: filters.industries || [],
          education: filters.education
        }
      };
      setCurrentSearchQuery(updatedQuery);
      console.log('✅ Search query updated with new filters:', updatedQuery);
    }
  };

  const handleRecentSearchClick = async (search: string) => {
    console.log('🔍 Clicked recent search:', search);
    
    if (!currentProject) {
      console.error('❌ No current project selected');
      return;
    }

    try {
      // Try to load saved search results
      const { data: searchResults, error } = await getSearchResults(search, currentProject.id);
      
      if (error) {
        console.error('❌ Error loading search results:', error);
        // Fall back to new search
        setInputValue(search);
        return;
      }

      if (searchResults && searchResults.length > 0) {
        console.log('✅ Loaded saved search results:', searchResults.length);
        
        // Convert database candidates to frontend format
        const candidateMatches: CandidateMatch[] = searchResults.map((result: any) => {
          // Find the candidate in our current candidates array
          const candidate = candidates.find(c => c.id === result.candidate_id);
          if (!candidate) {
            console.warn('⚠️ Candidate not found for result:', result.candidate_id);
            return null;
          }
          
          return {
            candidate,
            explanation: {
              score: result.score || 0,
              category: result.category || 'potential',
              reasons: result.reasons || ['Saved search result']
            }
          };
        }).filter(Boolean);

        setCurrentMatches(candidateMatches);
        setShowResults(true);
        
        // Clear any existing messages and show a simple message about loaded results
        setMessages([]);
        const loadedMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `📋 Loaded saved search results for "${search}" - ${candidateMatches.length} candidates found.`,
          timestamp: new Date()
        };
        setMessages([loadedMessage]);
        
        console.log('✅ Displaying saved search results');
      } else {
        // No saved results, perform new search
        console.log('🔄 No saved results, performing new search');
        setInputValue(search);
        // Auto-submit the search
        setTimeout(() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }, 100);
      }
    } catch (error) {
      console.error('❌ Error handling recent search click:', error);
      // Fall back to new search
      setInputValue(search);
    }
  };

  // Expose the handleRecentSearchClick function to parent components
  React.useEffect(() => {
    // This effect will run when the component mounts or when dependencies change
    // We can use this to handle external recent search clicks
    const handleExternalRecentSearch = (event: CustomEvent) => {
      handleRecentSearchClick(event.detail.search);
    };

    window.addEventListener('recentSearchClick', handleExternalRecentSearch as EventListener);
    
    return () => {
      window.removeEventListener('recentSearchClick', handleExternalRecentSearch as EventListener);
    };
  }, [candidates, currentProject]);

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">AI Candidate Search</h1>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                {candidates.length.toLocaleString()} Candidates
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                Streaming Search
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                console.log('🔄 Starting new search session...');
                setMessages([]);
                setShowResults(false);
                setCurrentMatches([]);
                setCurrentFilters(null);
                setCurrentSearchQuery(null);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              New Search
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {!showResults ? (
          /* Search Interface */
          <div className="flex-1 flex flex-col">
            {/* Search Method Buttons */}
            <div className="bg-white px-6 py-4 border-b border-gray-100">
              <div className="flex gap-2">
                {searchMethods.map((method) => {
                  const Icon = method.icon;
                  const isActive = activeSearchMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => {
                        console.log('🔄 Switching search method to:', method.label);
                        setActiveSearchMethod(method.id);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-8 bg-gray-50">
              <div className="max-w-4xl mx-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                      Intelligent Candidate Search
                    </h2>
                    <p className="text-gray-600 mb-4 max-w-2xl mx-auto">
                      Describe your ideal candidate in natural language. I'll use smart filtering and AI analysis to find the best matches from our database of {candidates.length.toLocaleString()} healthcare professionals.
                    </p>
                    
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <div className="mb-8 p-6 bg-white rounded-xl border border-gray-200 max-w-3xl mx-auto">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-blue-600" />
                          Recent Searches
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {recentSearches.slice(0, 6).map((search, index) => (
                            <button
                              key={index}
                              onClick={() => handleRecentSearchClick(search)}
                              className="p-3 text-left bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors text-sm text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-300"
                            >
                              <div className="flex items-start gap-2">
                                <Search className="w-4 h-4 mt-0.5 text-gray-400" />
                                <span className="truncate">"{search}"</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Search Process Overview */}
                    <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 max-w-3xl mx-auto">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-purple-600" />
                        How Our Streaming Search Works
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                          <div>
                            <div className="font-medium text-gray-900">AI Entity Extraction</div>
                            <div className="text-gray-600">Extract job titles, locations, skills, and requirements</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                          <div>
                            <div className="font-medium text-gray-900">Smart Filtering</div>
                            <div className="text-gray-600">Apply hard filters + fuzzy matching to narrow candidates</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                          <div>
                            <div className="font-medium text-gray-900">Streaming AI Analysis</div>
                            <div className="text-gray-600">Real-time AI scoring with live result updates</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
                      {[
                        "Registered Nurse in New York specializing in pediatric care, with 5+ years of experience",
                        "Clinical Nurse Specialist in London focusing on oncology, holding a master's degree",
                        "Emergency Room Nurse in Los Angeles, bilingual in Spanish and English",
                        "Healthcare Administrator in Toronto with 10+ years managing clinics"
                      ].map((query, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            console.log('📝 Using example query:', query);
                            setInputValue(query);
                          }}
                          className="p-4 text-left bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-sm transition-all duration-200 group"
                        >
                          <div className="flex items-start gap-3">
                            <Search className="w-5 h-5 text-purple-600 mt-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">
                              "{query}"
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <div key={message.id} className="flex gap-4">
                        <div className="flex-shrink-0">
                          {message.type === 'user' ? (
                            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">U</span>
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                              {message.isProcessing ? (
                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                              ) : (
                                <Sparkles className="w-5 h-5 text-white" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <p className="text-gray-800">{message.content}</p>
                            
                            {/* Progress indicator for processing messages */}
                            {message.isProcessing && message.searchProgress && (
                              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3 mb-2">
                                  <Clock className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium text-gray-900">
                                    Step {message.searchProgress.current} of {message.searchProgress.total}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(message.searchProgress.current / message.searchProgress.total) * 100}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-gray-600">{message.searchProgress.message}</p>
                              </div>
                            )}
                            
                            {message.type === 'assistant' && message.extractedFilters && !message.isProcessing && (
                              <div className="mt-6">
                                {/* Extracted Filters Display */}
                                <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-purple-600" />
                                    AI-Extracted Search Criteria
                                    <span className="ml-auto text-xs text-gray-500">Ready for search</span>
                                  </h4>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {message.extractedFilters.jobTitles?.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Job Titles</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {message.extractedFilters.jobTitles.slice(0, 3).map((title: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">
                                              {title}
                                            </span>
                                          ))}
                                          {message.extractedFilters.jobTitles.length > 3 && (
                                            <span 
                                              className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs cursor-pointer hover:bg-gray-200"
                                              title={message.extractedFilters.jobTitles.slice(3).join(', ')}
                                            >
                                              +{message.extractedFilters.jobTitles.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {message.extractedFilters.locations?.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Locations</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {message.extractedFilters.locations.map((location: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">
                                              {location}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {message.extractedFilters.experienceRange?.min && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Experience</span>
                                        <div className="mt-1">
                                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium">
                                            {message.extractedFilters.experienceRange.min}+ years
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {message.extractedFilters.skills?.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Skills</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {message.extractedFilters.skills.slice(0, 3).map((skill: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-xs font-medium">
                                              {skill}
                                            </span>
                                          ))}
                                          {message.extractedFilters.skills.length > 3 && (
                                            <span 
                                              className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs cursor-pointer hover:bg-gray-200"
                                              title={message.extractedFilters.skills.slice(3).join(', ')}
                                            >
                                              +{message.extractedFilters.skills.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {message.extractedFilters.industries?.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Industries</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {message.extractedFilters.industries.map((industry: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md text-xs font-medium">
                                              {industry}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {message.extractedFilters.education && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Education</span>
                                        <div className="mt-1">
                                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs font-medium">
                                            {message.extractedFilters.education}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {message.showSearchButton && (
                                  <div className="flex gap-3">
                                    <button 
                                      onClick={() => {
                                        console.log('✏️ Opening filter editor...');
                                        setShowFilterModal(true);
                                      }}
                                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                                    >
                                      <Edit className="w-4 h-4" />
                                      Edit Filters
                                    </button>
                                    <button 
                                      onClick={() => {
                                        console.log('🚀 Starting streaming candidate search...');
                                        handleSearchCandidates(message.searchQuery!);
                                      }}
                                      disabled={isSearching}
                                      className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
                                    >
                                      {isSearching ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Searching...
                                        </>
                                      ) : (
                                        <>
                                          <Search className="w-4 h-4" />
                                          Search Candidates
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Show results button after search is complete */}
                            {message.type === 'assistant' && !message.isProcessing && !message.showSearchButton && currentMatches.length > 0 && (
                              <div className="mt-4">
                                <button 
                                  onClick={handleViewResults}
                                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                  View {currentMatches.length} Results
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSubmit} className="relative">
                  {activeSearchMethod === 'jd' ? (
                    <div className="space-y-3">
                      <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Paste your job description here and I'll extract the key requirements..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-500 resize-none"
                        rows={4}
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          <Upload className="w-4 h-4" />
                          Upload File
                        </button>
                        <button
                          type="submit"
                          disabled={!inputValue.trim() || isProcessing}
                          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                        >
                          {isProcessing ? 'Analyzing...' : 'Extract Requirements'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={searchMethods.find(m => m.id === activeSearchMethod)?.placeholder}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                        disabled={isProcessing}
                      />
                      <button
                        type="submit"
                        disabled={!inputValue.trim() || isProcessing}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Search className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  )}
                </form>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  <strong>Streaming Search:</strong> Real-time results with AI analysis
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Results View */
          <CandidateTable 
            matches={currentMatches} 
            onBack={() => setShowResults(false)}
            onEditFilters={() => setShowFilterModal(true)}
            currentFilters={currentFilters}
            currentProject={currentProject}
          />
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <FilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filters={currentFilters}
          onSave={(filters) => {
            handleEditFilters(filters);
            setShowFilterModal(false);
          }}
        />
      )}
    </div>
  );
};

export default SearchView;