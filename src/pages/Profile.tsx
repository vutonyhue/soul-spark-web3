import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyProfile, updateMyProfile } from '@/lib/api';
import { Navigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Save, X, Coins, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import ImageUpload from '@/components/ui/image-upload';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  wallet_address: string | null;
  camly_balance: number | null;
  created_at: string;
}

const Profile = () => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    avatar_url: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await getMyProfile();

    if (error) {
      console.error('Error fetching profile:', error);
      toast.error('Không thể tải hồ sơ');
      return;
    }

    if (data?.profile) {
      setProfile(data.profile);
      setEditForm({
        display_name: data.profile.display_name || '',
        bio: data.profile.bio || '',
        avatar_url: data.profile.avatar_url || ''
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await updateMyProfile({
      display_name: editForm.display_name,
      bio: editForm.bio,
      avatar_url: editForm.avatar_url
    });

    setSaving(false);

    if (error) {
      toast.error('Không thể cập nhật hồ sơ');
      console.error('Error updating profile:', error);
      return;
    }

    toast.success('Cập nhật hồ sơ thành công!');
    setIsEditing(false);
    fetchProfile();
  };

  const handleCancel = () => {
    setEditForm({
      display_name: profile?.display_name || '',
      bio: profile?.bio || '',
      avatar_url: profile?.avatar_url || ''
    });
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <LeftSidebar />
        
        <main className="flex-1 max-w-4xl mx-auto p-6">
          {/* Profile Header Card */}
          <Card className="mb-6 overflow-hidden">
            <div className="h-32 gradient-chakra" />
            <CardContent className="relative pt-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-16">
                <div className="relative">
                  <Avatar className="w-32 h-32 border-4 border-card shadow-lg">
                    <AvatarImage src={isEditing ? editForm.avatar_url : profile?.avatar_url || ''} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {getInitials(profile?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <div className="absolute -bottom-1 -right-1">
                      <ImageUpload
                        purpose="avatar"
                        currentImageUrl={editForm.avatar_url}
                        onUploadComplete={(url) => setEditForm({ ...editForm, avatar_url: url })}
                        variant="button"
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 text-center sm:text-left pb-4">
                  {isEditing ? (
                    <Input
                      value={editForm.display_name}
                      onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                      placeholder="Tên hiển thị"
                      className="text-xl font-bold mb-2"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-foreground">
                      {profile?.display_name || 'Chưa có tên'}
                    </h1>
                  )}
                  <p className="text-muted-foreground text-sm">{user.email}</p>
                </div>

                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button onClick={handleSave} disabled={saving} size="sm">
                        <Save className="w-4 h-4 mr-1" />
                        {saving ? 'Đang lưu...' : 'Lưu'}
                      </Button>
                      <Button variant="outline" onClick={handleCancel} size="sm">
                        <X className="w-4 h-4 mr-1" />
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setIsEditing(true)} size="sm">
                      <Pencil className="w-4 h-4 mr-1" />
                      Chỉnh sửa
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Bio Section */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Giới thiệu
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="Viết vài dòng về bản thân..."
                    rows={4}
                  />
                ) : (
                  <p className="text-muted-foreground">
                    {profile?.bio || 'Chưa có thông tin giới thiệu'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Stats Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[hsl(var(--coin-gold))]" />
                  Thống kê
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                  <span className="text-sm text-muted-foreground">CAMLY Coins</span>
                  <span className="font-bold text-[hsl(var(--coin-gold))]">
                    {profile?.camly_balance?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Tham gia: {profile?.created_at ? formatDate(profile.created_at) : 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Activity History */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Lịch sử hoạt động</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <p>Chưa có hoạt động nào</p>
                  <p className="text-sm mt-1">Hoạt động của bạn sẽ hiển thị ở đây</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Profile;
