import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Home, Users, Bell, MessageCircle, Menu, LogIn } from 'lucide-react';
import HeartChakraIcon from '@/components/icons/HeartChakraIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import WalletConnect from '@/components/web3/WalletConnect';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: conversationsData } = useConversations();

  // Calculate total unread count
  const totalUnread = conversationsData?.conversations.reduce(
    (sum, c) => sum + (c.unread_count || 0), 
    0
  ) || 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo & Search */}
        <div className="flex items-center gap-3 flex-1">
          <Link to="/" className="flex items-center gap-2">
            <HeartChakraIcon size={36} className="text-primary animate-pulse-glow" />
            <span className="hidden sm:block text-xl font-bold text-gradient-chakra">
              Fun Profile
            </span>
          </Link>
          
          <div className="hidden md:flex relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm trên Fun Profile..."
              className="pl-10 bg-secondary border-0 rounded-full"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          <Button variant="ghost" size="lg" className="px-8 text-primary hover:bg-primary/10">
            <Home className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="lg" className="px-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
            <Users className="h-6 w-6" />
          </Button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-primary/10">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative text-muted-foreground hover:bg-primary/10"
                onClick={() => navigate('/messages')}
              >
                <MessageCircle className="h-5 w-5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Button>
              
              <WalletConnect />
              
              <Avatar className="h-9 w-9 ring-2 ring-primary/30 cursor-pointer">
                <AvatarImage src="/placeholder.svg" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </>
          ) : (
            <Link to="/auth">
              <Button className="gradient-chakra text-white font-semibold gap-2">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Đăng nhập</span>
              </Button>
            </Link>
          )}
          
          <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
