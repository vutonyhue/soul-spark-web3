import React, { useState } from 'react';
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

const WalletConnect: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const { toast } = useToast();

  const connectWallet = async () => {
    // Simulated wallet connection
    // In production, integrate with ethers.js or wagmi
    const mockAddress = '0x' + Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 6);
    setWalletAddress(mockAddress);
    setBalance(Math.floor(Math.random() * 10000));
    setIsConnected(true);
    
    toast({
      title: "Ví đã kết nối!",
      description: "Chào mừng bạn đến với Fun Profile Web3",
    });
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setWalletAddress('');
    setBalance(0);
    
    toast({
      title: "Đã ngắt kết nối ví",
      description: "Hẹn gặp lại bạn!",
    });
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast({
      title: "Đã sao chép địa chỉ ví",
    });
  };

  if (!isConnected) {
    return (
      <Button 
        onClick={connectWallet}
        className="gradient-chakra hover:opacity-90 text-primary-foreground gap-2"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">Kết nối ví</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-primary/30 hover:bg-primary/10 gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full gradient-chakra flex items-center justify-center">
              <Coins className="h-3 w-3 text-primary-foreground" />
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-xs font-bold text-primary">{balance.toLocaleString()} CAMLY</span>
              <span className="text-xs text-muted-foreground">{walletAddress}</span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="p-2">
          <p className="text-sm font-medium">Số dư CAMLY COIN</p>
          <p className="text-2xl font-bold text-primary">{balance.toLocaleString()}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress}>
          <Copy className="mr-2 h-4 w-4" />
          Sao chép địa chỉ
        </DropdownMenuItem>
        <DropdownMenuItem>
          <ExternalLink className="mr-2 h-4 w-4" />
          Xem trên Explorer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnectWallet} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Ngắt kết nối
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletConnect;
