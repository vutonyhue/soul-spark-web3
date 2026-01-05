import React from 'react';
import { Home, User, Users, Bookmark, Calendar, Gift, Settings, HelpCircle, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const menuItems = [
  { icon: User, label: 'Trang cá nhân', href: '#' },
  { icon: Users, label: 'Bạn bè', href: '#' },
  { icon: Bookmark, label: 'Đã lưu', href: '#' },
  { icon: Calendar, label: 'Sự kiện', href: '#' },
  { icon: Gift, label: 'Phần thưởng', href: '#', highlight: true },
];

const LeftSidebar: React.FC = () => {
  return (
    <aside className="hidden lg:block fixed left-0 top-14 bottom-0 w-72 p-4 overflow-y-auto">
      <nav className="space-y-1">
        {/* User Profile */}
        <Button variant="ghost" className="w-full justify-start gap-3 h-12 hover:bg-primary/10">
          <Avatar className="h-9 w-9 ring-2 ring-primary/30">
            <AvatarImage src="/placeholder.svg" />
            <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
          </Avatar>
          <span className="font-semibold">Người dùng</span>
        </Button>

        {/* Menu Items */}
        {menuItems.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            className={`w-full justify-start gap-3 h-12 ${
              item.highlight 
                ? 'text-primary hover:bg-primary/10' 
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <div className={`p-2 rounded-lg ${
              item.highlight 
                ? 'bg-primary/10' 
                : 'bg-muted'
            }`}>
              <item.icon className="h-5 w-5" />
            </div>
            <span className="font-medium">{item.label}</span>
          </Button>
        ))}
      </nav>

      {/* CAMLY Coin Rewards Card */}
      <div className="mt-6 p-4 rounded-xl gradient-chakra text-primary-foreground">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-5 w-5" />
          <span className="font-bold">CAMLY COIN</span>
        </div>
        <p className="text-sm opacity-90 mb-3">
          Tham gia Fun Profile và nhận thưởng CAMLY COIN mỗi ngày!
        </p>
        <Button 
          variant="secondary" 
          size="sm" 
          className="w-full bg-card/20 hover:bg-card/30 text-primary-foreground border-0"
        >
          Nhận thưởng ngay
        </Button>
      </div>

      {/* Footer Links */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <a href="#" className="hover:underline">Quyền riêng tư</a>
          <span>·</span>
          <a href="#" className="hover:underline">Điều khoản</a>
          <span>·</span>
          <a href="#" className="hover:underline">Quảng cáo</a>
        </div>
        <p className="text-xs text-muted-foreground mt-2">© 2025 Fun Profile</p>
      </div>
    </aside>
  );
};

export default LeftSidebar;
