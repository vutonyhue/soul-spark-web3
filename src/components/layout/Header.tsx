import React from 'react';
import { Search, Home, Users, Bell, MessageCircle, Menu } from 'lucide-react';
import HeartChakraIcon from '@/components/icons/HeartChakraIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import WalletConnect from '@/components/web3/WalletConnect';

const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo & Search */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <HeartChakraIcon size={36} className="text-primary animate-pulse-glow" />
            <span className="hidden sm:block text-xl font-bold text-gradient-chakra">
              Fun Profile
            </span>
          </div>
          
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
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-primary/10">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-primary/10">
            <MessageCircle className="h-5 w-5" />
          </Button>
          
          <WalletConnect />
          
          <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
