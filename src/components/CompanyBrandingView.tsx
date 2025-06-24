import React, { useState, useEffect, useContext } from 'react';
import { Plus, Building, Globe, Edit, Trash2, Eye, Copy, Search, Filter, Sparkles, Loader2, AlertCircle, CheckCircle, ExternalLink, FileText, Users, Target } from 'lucide-react';
import { AuthContext } from './AuthWrapper';
import { Project, CompanyProfile, CompanyCollateral, getCompanyProfiles, createCompanyProfile, updateCompanyProfile, deleteCompanyProfile, getCompanyCollateral, createCompanyCollateral, updateCompanyCollateral, deleteCompanyCollateral } from '../lib/supabase';
import { extractCompanyBranding, extractCompanyCollateral, type CompanyBrandingData } from '../utils/companyBranding';
import Button from './shared/Button';
import LoadingSpinner from './shared/LoadingSpinner';
import Badge from './shared/Badge';

interface CompanyBrandingViewProps {
  currentProject?: Project | null;
}

interface CompanyProfileWithCollateral extends CompanyProfile {
  collateral?: CompanyCollateral[];
}

const CompanyBrandingView: React.FC<CompanyBrandingViewProps> = ({ currentProject }) => {
  const { user } = useContext(AuthContext);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfileWithCollateral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CompanyProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<CompanyProfileWithCollateral | null>(null);

  useEffect(() => {
    if (user) {
      loadCompanyProfiles();
    }
  }, [user]);

  const loadCompanyProfiles = async () => {
    if (!user) return;

    console.log('🏢 Loading company profiles for user:', user.email);
    setLoading(true);

    try {
      const { data, error } = await getCompanyProfiles(user.id);
      
      if (error) {
        console.error('❌ Error loading company profiles:', error);
        return;
      }

      // Load collateral for each profile
      const profilesWithCollateral = await Promise.all(
        (data || []).map(async (profile) => {
          const { data: collateral } = await getCompanyCollateral(profile.id);
          return {
            ...profile,
            collateral: collateral || []
          };
        })
      );

      console.log('✅ Company profiles loaded:', profilesWithCollateral.length);
      setCompanyProfiles(profilesWithCollateral);
    } catch (error) {
      console.error('❌ Error in loadCompanyProfiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileCreated = (profile: CompanyProfile) => {
    setCompanyProfiles(prev => [{ ...profile, collateral: [] }, ...prev]);
    setShowCreateModal(false);
  };

  const handleProfileUpdated = (updatedProfile: CompanyProfile) => {
    setCompanyProfiles(prev => prev.map(profile => 
      profile.id === updatedProfile.id ? { ...profile, ...updatedProfile } : profile
    ));
    setShowCreateModal(false);
    setEditingProfile(null);
  };

  const handleEditProfile = (profile: CompanyProfile) => {
    setEditingProfile(profile);
    setShowCreateModal(true);
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this company profile? This will also delete all associated collateral.')) return;
    
    try {
      const { error } = await deleteCompanyProfile(profileId);
      
      if (error) {
        console.error('❌ Error deleting company profile:', error);
        return;
      }

      setCompanyProfiles(prev => prev.filter(p => p.id !== profileId));
      if (selectedProfile?.id === profileId) {
        setSelectedProfile(null);
      }
      
      console.log('✅ Company profile deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting company profile:', error);
    }
  };

  const handleViewProfile = (profile: CompanyProfileWithCollateral) => {
    setSelectedProfile(profile);
  };

  const filteredProfiles = companyProfiles.filter(profile =>
    profile.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading company profiles..." />
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gray-50 h-screen overflow-hidden">
      {/* Main Content */}
      <div className={`${selectedProfile ? 'flex-1' : 'w-full'} flex flex-col`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Company Branding</h1>
                <p className="text-sm text-gray-600">
                  Manage company profiles and knowledge base for campaigns
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingProfile(null);
                setShowCreateModal(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Company Profile
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search company profiles..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              {filteredProfiles.length} of {companyProfiles.length} profiles
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {filteredProfiles.length === 0 ? (
              /* Empty State */
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Building className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {companyProfiles.length === 0 ? 'No Company Profiles Yet' : 'No Matching Profiles'}
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {companyProfiles.length === 0 
                    ? 'Create company profiles to enhance your campaigns with branding information and collateral.'
                    : 'Try adjusting your search criteria.'
                  }
                </p>
                {companyProfiles.length === 0 && (
                  <Button
                    onClick={() => {
                      setEditingProfile(null);
                      setShowCreateModal(true);
                    }}
                    icon={<Plus className="w-5 h-5" />}
                    size="lg"
                  >
                    Create First Company Profile
                  </Button>
                )}
              </div>
            ) : (
              /* Company Profiles Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProfiles.map((profile) => (
                  <div key={profile.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    {/* Profile Header */}
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {profile.company_name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Globe className="w-4 h-4" />
                            {profile.company_url || 'No website'}
                          </div>
                          {profile.industry && (
                            <Badge variant="info" size="sm">
                              {profile.industry}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => handleEditProfile(profile)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Profile"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleViewProfile(profile)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(profile.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Profile Details */}
                    <div className="p-6">
                      {profile.description && (
                        <p className="text-sm text-gray-700 line-clamp-3 mb-4">
                          {profile.description}
                        </p>
                      )}

                      {profile.values && profile.values.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Company Values
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {profile.values.slice(0, 3).map((value, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                {value}
                              </span>
                            ))}
                            {profile.values.length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                +{profile.values.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Collateral Summary */}
                      <div className="mb-4">
                        <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Knowledge Base
                        </h5>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Collateral Items:</span>
                            <span className="font-medium text-gray-900">{profile.collateral?.length || 0}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Last Updated:</span>
                            <span className="font-medium text-gray-900">
                              {profile.last_updated ? new Date(profile.last_updated).toLocaleDateString() : 'Never'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* View Details Button */}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleViewProfile(profile)}
                        icon={<Eye className="w-4 h-4" />}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedProfile && (
        <CompanyProfileDetail
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onEdit={() => {
            handleEditProfile(selectedProfile);
            setSelectedProfile(null);
          }}
          onDelete={() => handleDeleteProfile(selectedProfile.id)}
          onCollateralUpdated={(updatedCollateral) => {
            // Update the collateral in the selected profile
            setSelectedProfile(prev => prev ? {
              ...prev,
              collateral: updatedCollateral
            } : null);
            
            // Also update in the main profiles list
            setCompanyProfiles(prev => prev.map(profile => 
              profile.id === selectedProfile.id 
                ? { ...profile, collateral: updatedCollateral }
                : profile
            ));
          }}
        />
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CompanyProfileModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProfile(null);
          }}
          onSuccess={editingProfile ? handleProfileUpdated : handleProfileCreated}
          editingProfile={editingProfile}
        />
      )}
    </div>
  );
};

interface CompanyProfileDetailProps {
  profile: CompanyProfileWithCollateral;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCollateralUpdated: (collateral: CompanyCollateral[]) => void;
}

const CompanyProfileDetail: React.FC<CompanyProfileDetailProps> = ({
  profile,
  onClose,
  onEdit,
  onDelete,
  onCollateralUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'collateral'>('overview');
  const [showAddCollateralModal, setShowAddCollateralModal] = useState(false);
  const [editingCollateral, setEditingCollateral] = useState<CompanyCollateral | null>(null);
  const [extractingCollateral, setExtractingCollateral] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const handleExtractCollateral = async () => {
    if (!profile.company_url) {
      setExtractionError('Company URL is required for extraction');
      return;
    }

    setExtractingCollateral(true);
    setExtractionError(null);

    try {
      console.log('🔍 Extracting collateral from:', profile.company_url);
      const collateral = await extractCompanyCollateral(profile.company_url);
      
      // Save each collateral item to the database
      const savedCollateral: CompanyCollateral[] = [];
      
      for (const item of collateral) {
        const { data, error } = await createCompanyCollateral({
          company_profile_id: profile.id,
          type: item.type,
          content: item.content,
          links: item.links,
          last_updated: item.last_updated,
          version: item.version
        });
        
        if (error) {
          console.error('❌ Error saving collateral item:', error);
        } else if (data) {
          savedCollateral.push(data);
        }
      }
      
      console.log('✅ Collateral extracted and saved:', savedCollateral.length, 'items');
      
      // Update the profile's collateral
      onCollateralUpdated([...(profile.collateral || []), ...savedCollateral]);
      
    } catch (error) {
      console.error('❌ Error extracting collateral:', error);
      setExtractionError('Failed to extract collateral. Please try again or add manually.');
    } finally {
      setExtractingCollateral(false);
    }
  };

  const handleDeleteCollateral = async (collateralId: string) => {
    if (!confirm('Are you sure you want to delete this collateral item?')) return;
    
    try {
      const { error } = await deleteCompanyCollateral(collateralId);
      
      if (error) {
        console.error('❌ Error deleting collateral:', error);
        return;
      }
      
      // Update the profile's collateral
      const updatedCollateral = (profile.collateral || []).filter(item => item.id !== collateralId);
      onCollateralUpdated(updatedCollateral);
      
      console.log('✅ Collateral deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting collateral:', error);
    }
  };

  const handleEditCollateral = (collateral: CompanyCollateral) => {
    setEditingCollateral(collateral);
    setShowAddCollateralModal(true);
  };

  const handleCollateralSaved = (collateral: CompanyCollateral) => {
    // Update the profile's collateral
    const updatedCollateral = editingCollateral
      ? (profile.collateral || []).map(item => item.id === collateral.id ? collateral : item)
      : [...(profile.collateral || []), collateral];
    
    onCollateralUpdated(updatedCollateral);
    setShowAddCollateralModal(false);
    setEditingCollateral(null);
  };

  const getCollateralTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'newsletters': 'Newsletters',
      'benefits': 'Benefits',
      'who_we_are': 'Who We Are',
      'mission_statements': 'Mission Statement',
      'dei_statements': 'DEI Statement',
      'talent_community_link': 'Talent Community',
      'career_site_link': 'Career Site',
      'company_logo': 'Company Logo'
    };
    
    return labels[type] || type;
  };

  const getCollateralTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      'newsletters': FileText,
      'benefits': Target,
      'who_we_are': Building,
      'mission_statements': Target,
      'dei_statements': Users,
      'talent_community_link': ExternalLink,
      'career_site_link': Globe,
      'company_logo': Building
    };
    
    const Icon = icons[type] || FileText;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="w-[500px] border-l border-gray-200 bg-white flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Company Profile</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="flex items-start gap-4">
          {profile.logo_url ? (
            <img 
              src={profile.logo_url} 
              alt={profile.company_name} 
              className="w-16 h-16 object-contain rounded-lg border border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building className="w-8 h-8 text-white" />
            </div>
          )}
          <div className="flex-1">
            <h4 className="text-xl font-semibold text-gray-900 mb-1">
              {profile.company_name}
            </h4>
            {profile.company_url && (
              <a 
                href={profile.company_url.startsWith('http') ? profile.company_url : `https://${profile.company_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
              >
                <Globe className="w-3 h-3" />
                {profile.company_url}
              </a>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                icon={<Edit className="w-3 h-3" />}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDelete}
                icon={<Trash2 className="w-3 h-3" />}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 px-6 flex-shrink-0">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
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
            onClick={() => setActiveTab('collateral')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'collateral'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Knowledge Base ({profile.collateral?.length || 0})
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Description */}
            {profile.description && (
              <div>
                <h5 className="font-semibold text-gray-900 mb-3">Description</h5>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {profile.description}
                </p>
              </div>
            )}

            {/* Industry & Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="font-semibold text-gray-900 mb-2">Industry</h5>
                <p className="text-sm text-gray-700">
                  {profile.industry || 'Not specified'}
                </p>
              </div>
              <div>
                <h5 className="font-semibold text-gray-900 mb-2">Size</h5>
                <p className="text-sm text-gray-700">
                  {profile.size || 'Not specified'}
                </p>
              </div>
            </div>

            {/* Location */}
            <div>
              <h5 className="font-semibold text-gray-900 mb-2">Location</h5>
              <p className="text-sm text-gray-700">
                {profile.location || 'Not specified'}
              </p>
            </div>

            {/* Values */}
            {profile.values && profile.values.length > 0 && (
              <div>
                <h5 className="font-semibold text-gray-900 mb-3">Company Values</h5>
                <div className="flex flex-wrap gap-2">
                  {profile.values.map((value, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Benefits */}
            {profile.benefits && profile.benefits.length > 0 && (
              <div>
                <h5 className="font-semibold text-gray-900 mb-3">Benefits</h5>
                <div className="flex flex-wrap gap-2">
                  {profile.benefits.map((benefit, index) => (
                    <span key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Culture Keywords */}
            {profile.culture_keywords && profile.culture_keywords.length > 0 && (
              <div>
                <h5 className="font-semibold text-gray-900 mb-3">Culture</h5>
                <div className="flex flex-wrap gap-2">
                  {profile.culture_keywords.map((keyword, index) => (
                    <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'collateral' && (
          <div className="p-6 space-y-6">
            {/* Collateral Header */}
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">Knowledge Base</h4>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingCollateral(null);
                    setShowAddCollateralModal(true);
                  }}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add Manually
                </Button>
                <Button
                  size="sm"
                  onClick={handleExtractCollateral}
                  loading={extractingCollateral}
                  disabled={extractingCollateral || !profile.company_url}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Extract Automatically
                </Button>
              </div>
            </div>

            {/* Extraction Status */}
            {extractingCollateral && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Extracting company collateral...</p>
                    <p className="text-sm text-blue-700">This may take a few moments</p>
                  </div>
                </div>
              </div>
            )}

            {extractionError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Extraction Failed</p>
                    <p className="text-sm text-red-700">{extractionError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Collateral List */}
            {(!profile.collateral || profile.collateral.length === 0) ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h5 className="font-medium text-gray-900 mb-2">No Collateral Yet</h5>
                <p className="text-sm text-gray-600 mb-4">
                  Add company collateral to enhance your campaigns with branded content.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingCollateral(null);
                      setShowAddCollateralModal(true);
                    }}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Add Manually
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleExtractCollateral}
                    disabled={!profile.company_url}
                    icon={<Sparkles className="w-4 h-4" />}
                  >
                    Extract Automatically
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {profile.collateral.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getCollateralTypeIcon(item.type)}
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-900">{getCollateralTypeLabel(item.type)}</h5>
                          <p className="text-xs text-gray-500">
                            Version {item.version} • Updated {new Date(item.last_updated).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditCollateral(item)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Collateral"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCollateral(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Collateral"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="mb-3">
                      {['talent_community_link', 'career_site_link', 'company_logo'].includes(item.type) ? (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <a 
                            href={item.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 underline truncate flex-1"
                          >
                            {item.content}
                          </a>
                          <button
                            onClick={() => navigator.clipboard.writeText(item.content)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy URL"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700 line-clamp-3">
                            {item.content}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Links */}
                    {item.links && item.links.length > 0 && (
                      <div>
                        <h6 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Associated Links
                        </h6>
                        <div className="space-y-1">
                          {item.links.map((link, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                              <a 
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 truncate"
                              >
                                {link}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Collateral Modal */}
      {showAddCollateralModal && (
        <CollateralModal
          isOpen={showAddCollateralModal}
          onClose={() => {
            setShowAddCollateralModal(false);
            setEditingCollateral(null);
          }}
          onSuccess={handleCollateralSaved}
          companyProfileId={profile.id}
          editingCollateral={editingCollateral}
        />
      )}
    </div>
  );
};

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: CompanyProfile) => void;
  editingProfile?: CompanyProfile | null;
}

const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingProfile
}) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string>('');
  
  const [formData, setFormData] = useState({
    company_name: editingProfile?.company_name || '',
    company_url: editingProfile?.company_url || '',
    logo_url: editingProfile?.logo_url || '',
    description: editingProfile?.description || '',
    industry: editingProfile?.industry || '',
    size: editingProfile?.size || '',
    location: editingProfile?.location || '',
    values: editingProfile?.values || [],
    benefits: editingProfile?.benefits || [],
    culture_keywords: editingProfile?.culture_keywords || []
  });

  // Reset form when modal opens/closes or editing profile changes
  React.useEffect(() => {
    if (isOpen) {
      if (editingProfile) {
        setFormData({
          company_name: editingProfile.company_name || '',
          company_url: editingProfile.company_url || '',
          logo_url: editingProfile.logo_url || '',
          description: editingProfile.description || '',
          industry: editingProfile.industry || '',
          size: editingProfile.size || '',
          location: editingProfile.location || '',
          values: editingProfile.values || [],
          benefits: editingProfile.benefits || [],
          culture_keywords: editingProfile.culture_keywords || []
        });
      } else {
        // Reset for new profile
        setFormData({
          company_name: '',
          company_url: '',
          logo_url: '',
          description: '',
          industry: '',
          size: '',
          location: '',
          values: [],
          benefits: [],
          culture_keywords: []
        });
      }
      setError('');
      setExtractionError('');
    }
  }, [isOpen, editingProfile]);

  const handleExtractBranding = async () => {
    if (!formData.company_url) {
      setExtractionError('Company URL is required for extraction');
      return;
    }

    setExtracting(true);
    setExtractionError('');
    
    try {
      console.log('🔍 Extracting company branding from:', formData.company_url);
      const brandingData = await extractCompanyBranding(formData.company_url);
      
      console.log('✅ Company branding extracted successfully:', brandingData);
      
      // Update form with extracted data, preserving any existing data
      setFormData(prev => ({
        ...prev,
        company_name: prev.company_name || brandingData.name,
        description: prev.description || brandingData.description,
        industry: prev.industry || brandingData.industry,
        size: prev.size || brandingData.size,
        location: prev.location || brandingData.location,
        values: prev.values.length > 0 ? prev.values : brandingData.values,
        benefits: prev.benefits.length > 0 ? prev.benefits : brandingData.benefits,
        culture_keywords: prev.culture_keywords.length > 0 ? prev.culture_keywords : brandingData.cultureKeywords,
        logo_url: prev.logo_url || brandingData.logoUrl
      }));
      
    } catch (error) {
      console.error('❌ Error extracting company branding:', error);
      setExtractionError('Failed to extract company branding. Please check the URL and try again, or fill the details manually.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profileData = {
        user_id: user.id,
        company_name: formData.company_name.trim(),
        company_url: formData.company_url.trim(),
        logo_url: formData.logo_url.trim() || undefined,
        description: formData.description.trim() || undefined,
        industry: formData.industry.trim() || undefined,
        size: formData.size.trim() || undefined,
        location: formData.location.trim() || undefined,
        values: formData.values.filter(v => v.trim()),
        benefits: formData.benefits.filter(b => b.trim()),
        culture_keywords: formData.culture_keywords.filter(k => k.trim()),
        last_updated: new Date().toISOString()
      };

      let result;
      if (editingProfile) {
        result = await updateCompanyProfile(editingProfile.id, profileData);
      } else {
        result = await createCompanyProfile(profileData);
      }

      if (result.error) {
        setError(result.error.message);
        return;
      }

      console.log('✅ Company profile saved successfully');
      onSuccess(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company profile');
    } finally {
      setLoading(false);
    }
  };

  const addArrayItem = (field: 'values' | 'benefits' | 'culture_keywords') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const updateArrayItem = (field: 'values' | 'benefits' | 'culture_keywords', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const removeArrayItem = (field: 'values' | 'benefits' | 'culture_keywords', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingProfile ? 'Edit Company Profile' : 'Create Company Profile'}
              </h2>
              <p className="text-sm text-gray-600">
                {editingProfile ? 'Update company information' : 'Add a new company to enhance your campaigns'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* URL Extraction Section */}
          {!editingProfile && (
            <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-xl">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Auto-Extract Company Information
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Enter the company website URL and we'll automatically extract branding information.
              </p>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={formData.company_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_url: e.target.value }))}
                    placeholder="https://company.com"
                    className="flex-1 px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button
                    onClick={handleExtractBranding}
                    loading={extracting}
                    disabled={!formData.company_url.trim() || extracting}
                    icon={<Sparkles className="w-4 h-4" />}
                  >
                    {extracting ? 'Extracting...' : 'Extract Info'}
                  </Button>
                </div>
                
                {extractionError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-700">
                      <p className="font-medium mb-1">Extraction Failed</p>
                      <p>{extractionError}</p>
                    </div>
                  </div>
                )}
                
                {extracting && (
                  <div className="flex items-center gap-3 p-4 bg-white border border-blue-200 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">Extracting company information...</p>
                      <p className="text-gray-600">This may take a few seconds</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Company Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., HCA Healthcare"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Website
                </label>
                <input
                  type="url"
                  value={formData.company_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_url: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://company.com/logo.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Brief description of the company..."
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select size...</option>
                    <option value="Startup">Startup</option>
                    <option value="Small">Small (1-50 employees)</option>
                    <option value="Medium">Medium (51-500 employees)</option>
                    <option value="Large">Large (501-5000 employees)</option>
                    <option value="Enterprise">Enterprise (5000+ employees)</option>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Nashville, TN"
                  />
                </div>
              </div>
            </div>

            {/* Company Values */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Company Values</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem('values')}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add Value
                </Button>
              </div>
              
              <div className="space-y-2">
                {formData.values.map((value, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateArrayItem('values', index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Integrity"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeArrayItem('values', index)}
                      icon={<Trash2 className="w-4 h-4" />}
                    />
                  </div>
                ))}
                {formData.values.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No values added yet</p>
                )}
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Benefits</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem('benefits')}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add Benefit
                </Button>
              </div>
              
              <div className="space-y-2">
                {formData.benefits.map((benefit, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={benefit}
                      onChange={(e) => updateArrayItem('benefits', index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Health Insurance"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeArrayItem('benefits', index)}
                      icon={<Trash2 className="w-4 h-4" />}
                    />
                  </div>
                ))}
                {formData.benefits.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No benefits added yet</p>
                )}
              </div>
            </div>

            {/* Culture Keywords */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Culture Keywords</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem('culture_keywords')}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add Keyword
                </Button>
              </div>
              
              <div className="space-y-2">
                {formData.culture_keywords.map((keyword, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => updateArrayItem('culture_keywords', index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., collaborative"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeArrayItem('culture_keywords', index)}
                      icon={<Trash2 className="w-4 h-4" />}
                    />
                  </div>
                ))}
                {formData.culture_keywords.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No culture keywords added yet</p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              loading={loading}
              disabled={!formData.company_name}
            >
              {editingProfile ? 'Update Profile' : 'Create Profile'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CollateralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (collateral: CompanyCollateral) => void;
  companyProfileId: string;
  editingCollateral?: CompanyCollateral | null;
}

const CollateralModal: React.FC<CollateralModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyProfileId,
  editingCollateral
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  const [formData, setFormData] = useState({
    type: editingCollateral?.type || 'who_we_are',
    content: editingCollateral?.content || '',
    links: editingCollateral?.links || []
  });

  // Reset form when modal opens/closes or editing collateral changes
  React.useEffect(() => {
    if (isOpen) {
      if (editingCollateral) {
        setFormData({
          type: editingCollateral.type,
          content: editingCollateral.content,
          links: editingCollateral.links
        });
      } else {
        // Reset for new collateral
        setFormData({
          type: 'who_we_are',
          content: '',
          links: []
        });
      }
      setError('');
    }
  }, [isOpen, editingCollateral]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.content.trim()) {
      setError('Content is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const collateralData = {
        company_profile_id: companyProfileId,
        type: formData.type as CompanyCollateral['type'],
        content: formData.content.trim(),
        links: formData.links.filter(link => link.trim()),
        last_updated: new Date().toISOString(),
        version: editingCollateral?.version || '1.0'
      };

      let result;
      if (editingCollateral) {
        result = await updateCompanyCollateral(editingCollateral.id, collateralData);
      } else {
        result = await createCompanyCollateral(collateralData);
      }

      if (result.error) {
        setError(result.error.message);
        return;
      }

      console.log('✅ Collateral saved successfully');
      onSuccess(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save collateral');
    } finally {
      setLoading(false);
    }
  };

  const addLink = () => {
    setFormData(prev => ({
      ...prev,
      links: [...prev.links, '']
    }));
  };

  const updateLink = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.map((link, i) => i === index ? value : link)
    }));
  };

  const removeLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCollateral ? 'Edit Collateral' : 'Add Collateral'}
              </h2>
              <p className="text-sm text-gray-600">
                {editingCollateral ? 'Update company collateral' : 'Add new company collateral for campaigns'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Collateral Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as CompanyCollateral['type'] }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="who_we_are">Who We Are</option>
                <option value="mission_statements">Mission Statement</option>
                <option value="dei_statements">DEI Statement</option>
                <option value="benefits">Benefits</option>
                <option value="newsletters">Newsletters</option>
                <option value="talent_community_link">Talent Community Link</option>
                <option value="career_site_link">Career Site Link</option>
                <option value="company_logo">Company Logo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              {['talent_community_link', 'career_site_link', 'company_logo'].includes(formData.type) ? (
                <input
                  type="url"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com"
                  required
                />
              ) : (
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter content here..."
                  required
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Associated Links
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addLink}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add Link
                </Button>
              </div>
              <div className="space-y-2">
                {formData.links.map((link, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => updateLink(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLink(index)}
                      icon={<Trash2 className="w-4 h-4" />}
                    />
                  </div>
                ))}
                {formData.links.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No links added yet</p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              loading={loading}
              disabled={!formData.content}
            >
              {editingCollateral ? 'Update Collateral' : 'Add Collateral'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyBrandingView;