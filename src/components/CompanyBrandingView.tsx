import React, { useState, useEffect, useContext } from 'react';
import { Building, Globe, Plus, Trash2, Edit, Eye, ExternalLink, Briefcase, MapPin, Users, Check, X, Loader2, Upload, FileText, Sparkles, Info, Zap, Calendar, Clock } from 'lucide-react';
import { AuthContext } from './AuthWrapper';
import { Project, getCompanyProfiles, createCompanyProfile, updateCompanyProfile, deleteCompanyProfile, getCompanyCollateral, createCompanyCollateral, CompanyProfile, CompanyCollateral } from '../lib/supabase';
import { extractCompanyBranding, extractCompanyCollateral, CompanyBrandingData } from '../utils/companyBranding';
import Button from './shared/Button';
import ConfirmationModal from './ConfirmationModal';

interface CompanyBrandingViewProps {
  currentProject?: Project | null;
}

const CompanyBrandingView: React.FC<CompanyBrandingViewProps> = ({ currentProject }) => {
  const { user } = useContext(AuthContext);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<CompanyProfile | null>(null);
  const [collateral, setCollateral] = useState<CompanyCollateral[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'knowledge'>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<{
    company_name: string;
    company_url: string;
    description?: string;
    industry?: string;
    size?: string;
    location?: string;
    values?: string[];
    benefits?: string[];
    culture_keywords?: string[];
    logo_url?: string;
  }>({
    company_name: '',
    company_url: '',
    description: '',
    industry: 'Healthcare',
    size: 'Enterprise',
    location: 'Multiple locations',
    values: [],
    benefits: [],
    culture_keywords: []
  });

  // New value/benefit input state
  const [newValue, setNewValue] = useState('');
  const [newBenefit, setNewBenefit] = useState('');

  useEffect(() => {
    if (user && currentProject) {
      loadCompanyProfiles();
    }
  }, [user, currentProject]);

  useEffect(() => {
    if (selectedProfile) {
      loadCollateral(selectedProfile.id);
    }
  }, [selectedProfile]);

  const loadCompanyProfiles = async () => {
    if (!user) return;

    console.log('🏢 Loading company profiles...');
    setLoading(true);

    try {
      const { data, error } = await getCompanyProfiles(user.id);
      
      if (error) {
        console.error('❌ Error loading company profiles:', error);
        return;
      }

      console.log('✅ Company profiles loaded:', data?.length || 0);
      setCompanyProfiles(data || []);
      
      // Select the first profile by default if available
      if (data && data.length > 0 && !selectedProfile) {
        setSelectedProfile(data[0]);
      }
    } catch (error) {
      console.error('❌ Error in loadCompanyProfiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollateral = async (profileId: string) => {
    console.log('📚 Loading collateral for profile:', profileId);

    try {
      const { data, error } = await getCompanyCollateral(profileId);
      
      if (error) {
        console.error('❌ Error loading collateral:', error);
        return;
      }

      console.log('✅ Collateral loaded:', data?.length || 0);
      setCollateral(data || []);
    } catch (error) {
      console.error('❌ Error in loadCollateral:', error);
    }
  };

  const handleCreateProfile = async () => {
    if (!user || !formData.company_name || !formData.company_url) {
      console.error('❌ Missing required fields for company profile');
      return;
    }

    setIsProcessing(true);
    console.log('🏢 Creating company profile:', formData.company_name);

    try {
      // Extract branding data from URL
      console.log('🔍 Extracting branding data from URL:', formData.company_url);
      const brandingData = await extractCompanyBranding(formData.company_url);
      
      // Create profile
      const profileData = {
        user_id: user.id,
        company_name: formData.company_name,
        company_url: formData.company_url,
        description: brandingData.description,
        industry: brandingData.industry,
        size: brandingData.size,
        location: brandingData.location,
        values: brandingData.values,
        benefits: brandingData.benefits,
        culture_keywords: brandingData.cultureKeywords,
        logo_url: brandingData.logoUrl,
        ai_extracted_data: brandingData,
        last_updated: new Date().toISOString()
      };
      
      const { data: profile, error } = await createCompanyProfile(profileData);
      
      if (error) {
        console.error('❌ Error creating company profile:', error);
        return;
      }
      
      console.log('✅ Company profile created:', profile);
      
      // Extract and create collateral
      console.log('🔍 Extracting collateral from URL:', formData.company_url);
      const collateralData = await extractCompanyCollateral(formData.company_url);
      
      // Create collateral items
      for (const item of collateralData) {
        const { error: collateralError } = await createCompanyCollateral({
          ...item,
          company_profile_id: profile.id
        });
        
        if (collateralError) {
          console.error('❌ Error creating collateral item:', collateralError);
        }
      }
      
      console.log('✅ Collateral created successfully');
      
      // Reload profiles and select the new one
      await loadCompanyProfiles();
      setSelectedProfile(profile);
      setShowCreateModal(false);
      
      // Reset form
      setFormData({
        company_name: '',
        company_url: '',
        description: '',
        industry: 'Healthcare',
        size: 'Enterprise',
        location: 'Multiple locations',
        values: [],
        benefits: [],
        culture_keywords: []
      });
      
    } catch (error) {
      console.error('❌ Error in handleCreateProfile:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!selectedProfile) return;

    setIsProcessing(true);
    console.log('✏️ Updating company profile:', selectedProfile.id);

    try {
      const { error } = await updateCompanyProfile(selectedProfile.id, {
        company_name: formData.company_name,
        company_url: formData.company_url,
        description: formData.description,
        industry: formData.industry,
        size: formData.size,
        location: formData.location,
        values: formData.values,
        benefits: formData.benefits,
        culture_keywords: formData.culture_keywords,
        logo_url: formData.logo_url,
        last_updated: new Date().toISOString()
      });
      
      if (error) {
        console.error('❌ Error updating company profile:', error);
        return;
      }
      
      console.log('✅ Company profile updated');
      
      // Reload profiles
      await loadCompanyProfiles();
      setShowEditModal(false);
      
    } catch (error) {
      console.error('❌ Error in handleUpdateProfile:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return;

    setIsProcessing(true);
    console.log('🗑️ Deleting company profile:', selectedProfile.id);

    try {
      const { error } = await deleteCompanyProfile(selectedProfile.id);
      
      if (error) {
        console.error('❌ Error deleting company profile:', error);
        return;
      }
      
      console.log('✅ Company profile deleted');
      
      // Update state
      setCompanyProfiles(prev => prev.filter(p => p.id !== selectedProfile.id));
      setSelectedProfile(null);
      setShowDeleteConfirmation(false);
      
    } catch (error) {
      console.error('❌ Error in handleDeleteProfile:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditClick = () => {
    if (!selectedProfile) return;
    
    // Populate form with selected profile data
    setFormData({
      company_name: selectedProfile.company_name,
      company_url: selectedProfile.company_url,
      description: selectedProfile.description || '',
      industry: selectedProfile.industry || 'Healthcare',
      size: selectedProfile.size || 'Enterprise',
      location: selectedProfile.location || 'Multiple locations',
      values: selectedProfile.values || [],
      benefits: selectedProfile.benefits || [],
      culture_keywords: selectedProfile.culture_keywords || [],
      logo_url: selectedProfile.logo_url
    });
    
    setShowEditModal(true);
  };

  const handleAddValue = () => {
    if (!newValue.trim()) return;
    setFormData(prev => ({
      ...prev,
      values: [...(prev.values || []), newValue.trim()]
    }));
    setNewValue('');
  };

  const handleRemoveValue = (index: number) => {
    setFormData(prev => ({
      ...prev,
      values: (prev.values || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddBenefit = () => {
    if (!newBenefit.trim()) return;
    setFormData(prev => ({
      ...prev,
      benefits: [...(prev.benefits || []), newBenefit.trim()]
    }));
    setNewBenefit('');
  };

  const handleRemoveBenefit = (index: number) => {
    setFormData(prev => ({
      ...prev,
      benefits: (prev.benefits || []).filter((_, i) => i !== index)
    }));
  };

  const filteredProfiles = companyProfiles.filter(profile => 
    profile.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.company_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (profile.industry && profile.industry.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCollateralTypeIcon = (type: string) => {
    switch (type) {
      case 'newsletters': return <FileText className="w-4 h-4 text-blue-600" />;
      case 'benefits': return <Check className="w-4 h-4 text-green-600" />;
      case 'who_we_are': return <Users className="w-4 h-4 text-purple-600" />;
      case 'mission_statements': return <Zap className="w-4 h-4 text-orange-600" />;
      case 'dei_statements': return <Users className="w-4 h-4 text-blue-600" />;
      case 'talent_community_link': return <ExternalLink className="w-4 h-4 text-purple-600" />;
      case 'career_site_link': return <Briefcase className="w-4 h-4 text-green-600" />;
      case 'company_logo': return <Image className="w-4 h-4 text-blue-600" />;
      default: return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatCollateralType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Building className="h-16 w-16 text-gray-300 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">No Project Selected</h3>
          <p className="text-gray-600">Please select a project to manage company branding.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading company profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Company Branding</h1>
              <p className="text-sm text-gray-600">
                Manage company profiles and knowledge base for {currentProject.name}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Company Profile
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Company List */}
        <div className="w-[320px] bg-white border-r border-gray-200 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search company profiles..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {filteredProfiles.length} {filteredProfiles.length === 1 ? 'profile' : 'profiles'} found
            </div>
          </div>

          {/* Company List */}
          <div className="flex-1 overflow-y-auto">
            {filteredProfiles.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">No company profiles found</p>
                <p className="text-sm text-gray-500">
                  {searchTerm ? 'Try a different search term' : 'Add your first company profile'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedProfile?.id === profile.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {profile.logo_url ? (
                        <img 
                          src={profile.logo_url} 
                          alt={profile.company_name} 
                          className="w-10 h-10 object-contain rounded-lg bg-white border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-medium">
                            {profile.company_name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{profile.company_name}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <Globe className="w-3 h-3" />
                          <span className="truncate">{profile.company_url}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {profile.industry || 'Healthcare'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(profile.last_updated).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        {selectedProfile ? (
          <div className="flex-1 overflow-y-auto">
            {/* Profile Header */}
            <div className="bg-white p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {selectedProfile.logo_url ? (
                    <img 
                      src={selectedProfile.logo_url} 
                      alt={selectedProfile.company_name} 
                      className="w-16 h-16 object-contain rounded-lg bg-white border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xl font-medium">
                        {selectedProfile.company_name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">{selectedProfile.company_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <a 
                        href={selectedProfile.company_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Globe className="w-4 h-4" />
                        {selectedProfile.company_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleEditClick}
                    icon={<Edit className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirmation(true)}
                    icon={<Trash2 className="w-4 h-4" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-6 mt-6">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-2 border-b-2 font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Overview
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('knowledge')}
                  className={`py-2 border-b-2 font-medium transition-colors ${
                    activeTab === 'knowledge'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Knowledge Base ({collateral.length})
                  </div>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'overview' ? (
                <div className="space-y-8">
                  {/* Description */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Company Description</h3>
                    </div>
                    <div className="p-6">
                      <p className="text-gray-700 leading-relaxed">
                        {selectedProfile.description || 'No description available.'}
                      </p>
                    </div>
                  </div>

                  {/* Company Details */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Company Details</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Industry</h4>
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-blue-600" />
                            <span className="text-gray-900">{selectedProfile.industry || 'Healthcare'}</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Size</h4>
                          <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            <span className="text-gray-900">{selectedProfile.size || 'Enterprise'}</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Location</h4>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-600" />
                            <span className="text-gray-900">{selectedProfile.location || 'Multiple locations'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company Values */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Company Values</h3>
                    </div>
                    <div className="p-6">
                      {selectedProfile.values && selectedProfile.values.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedProfile.values.map((value, index) => (
                            <span 
                              key={index} 
                              className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No values specified</p>
                      )}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Benefits</h3>
                    </div>
                    <div className="p-6">
                      {selectedProfile.benefits && selectedProfile.benefits.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedProfile.benefits.map((benefit, index) => (
                            <span 
                              key={index} 
                              className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                            >
                              {benefit}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No benefits specified</p>
                      )}
                    </div>
                  </div>

                  {/* Culture Keywords */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Culture Keywords</h3>
                    </div>
                    <div className="p-6">
                      {selectedProfile.culture_keywords && selectedProfile.culture_keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedProfile.culture_keywords.map((keyword, index) => (
                            <span 
                              key={index} 
                              className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No culture keywords specified</p>
                      )}
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="flex items-center justify-end gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Last updated: {new Date(selectedProfile.last_updated).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Knowledge Base */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Knowledge Base</h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {collateral.length} items
                      </span>
                    </div>
                    <div className="p-6">
                      {collateral.length === 0 ? (
                        <div className="text-center py-8">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-600 mb-2">No collateral items found</p>
                          <p className="text-sm text-gray-500">
                            Collateral is automatically extracted when creating a company profile
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {collateral.map((item) => (
                            <div key={item.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-white rounded-lg border border-gray-200 flex-shrink-0">
                                  {getCollateralTypeIcon(item.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-gray-900 mb-1">
                                    {formatCollateralType(item.type)}
                                  </h4>
                                  
                                  {/* Content preview or link */}
                                  {['talent_community_link', 'career_site_link', 'company_logo'].includes(item.type) ? (
                                    <a 
                                      href={item.content} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                    >
                                      {item.content.substring(0, 50)}{item.content.length > 50 ? '...' : ''}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <p className="text-sm text-gray-600 line-clamp-2">
                                      {item.content.substring(0, 150)}{item.content.length > 150 ? '...' : ''}
                                    </p>
                                  )}
                                  
                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(item.last_updated).toLocaleDateString()}
                                    </span>
                                    {item.links.length > 0 && (
                                      <span className="flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" />
                                        {item.links.length} {item.links.length === 1 ? 'link' : 'links'}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Info className="w-3 h-3" />
                                      v{item.version}
                                    </span>
                                  </div>
                                </div>
                                
                                <button 
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Extraction Info */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Knowledge Extraction</h3>
                        <p className="text-gray-700 mb-4">
                          Our AI automatically extracts company information, values, benefits, and collateral from your company website.
                          This data is used to personalize campaigns and provide relevant information to candidates.
                        </p>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Zap className="w-4 h-4 text-purple-600" />
                            <span>Automatic extraction</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span>Rich content library</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Users className="w-4 h-4 text-green-600" />
                            <span>Personalized campaigns</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {companyProfiles.length === 0 ? 'No Company Profiles Yet' : 'Select a Company Profile'}
              </h3>
              <p className="text-gray-600 mb-8">
                {companyProfiles.length === 0 
                  ? 'Create your first company profile to manage branding and content for your campaigns.'
                  : 'Select a company profile from the list to view and manage its details.'
                }
              </p>
              {companyProfiles.length === 0 && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  icon={<Plus className="w-5 h-5" />}
                  size="lg"
                >
                  Create Company Profile
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Create Company Profile</h2>
                  <p className="text-sm text-gray-600">
                    Enter company details to create a new profile
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., HCA Healthcare"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Website URL *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      value={formData.company_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_url: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://www.example.com"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    We'll use AI to extract company information from this URL
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">AI-Powered Extraction</h4>
                      <p className="text-sm text-blue-700">
                        Our AI will automatically extract company information, values, benefits, and collateral from the provided URL.
                        You'll be able to edit this information after creation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-6">
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProfile}
                  disabled={isProcessing || !formData.company_name || !formData.company_url}
                  loading={isProcessing}
                  icon={isProcessing ? undefined : <Sparkles className="w-4 h-4" />}
                >
                  {isProcessing ? 'Creating Profile...' : 'Create with AI'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Edit className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Edit Company Profile</h2>
                  <p className="text-sm text-gray-600">
                    Update company information and branding
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., HCA Healthcare"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Website URL *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      value={formData.company_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_url: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://www.example.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Company description..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Healthcare"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Size
                    </label>
                    <select
                      value={formData.size}
                      onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Startup">Startup</option>
                      <option value="Small">Small</option>
                      <option value="Medium">Medium</option>
                      <option value="Large">Large</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Multiple locations"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Values
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.values?.map((value, index) => (
                      <div 
                        key={index} 
                        className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        <span>{value}</span>
                        <button 
                          onClick={() => handleRemoveValue(index)}
                          className="p-0.5 text-blue-700 hover:text-blue-900 hover:bg-blue-200 rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add a company value..."
                      onKeyPress={(e) => e.key === 'Enter' && handleAddValue()}
                    />
                    <Button
                      onClick={handleAddValue}
                      disabled={!newValue.trim()}
                      variant="outline"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Benefits
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.benefits?.map((benefit, index) => (
                      <div 
                        key={index} 
                        className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                      >
                        <span>{benefit}</span>
                        <button 
                          onClick={() => handleRemoveBenefit(index)}
                          className="p-0.5 text-green-700 hover:text-green-900 hover:bg-green-200 rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newBenefit}
                      onChange={(e) => setNewBenefit(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add a benefit..."
                      onKeyPress={(e) => e.key === 'Enter' && handleAddBenefit()}
                    />
                    <Button
                      onClick={handleAddBenefit}
                      disabled={!newBenefit.trim()}
                      variant="outline"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo URL (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={formData.logo_url || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter a direct URL to your company logo image
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-6">
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateProfile}
                  disabled={isProcessing || !formData.company_name || !formData.company_url}
                  loading={isProcessing}
                >
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleDeleteProfile}
        title="Delete Company Profile"
        message={`Are you sure you want to delete the profile for ${selectedProfile?.company_name}? This action cannot be undone and will remove all associated collateral.`}
        confirmText={isProcessing ? "Deleting..." : "Delete Profile"}
        cancelText="Cancel"
        confirmVariant="danger"
      />
    </div>
  );
};

// Custom Search icon component
const Search = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

// Custom Image icon component
const Image = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

export default CompanyBrandingView;