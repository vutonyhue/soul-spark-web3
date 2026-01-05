import React from 'react';
import { TrendingUp, Users, Gift, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const trendingTopics = [
  { tag: '#Web3Vietnam', posts: '2.5K bài viết' },
  { tag: '#CamlyCoin', posts: '1.8K bài viết' },
  { tag: '#HeartChakra', posts: '956 bài viết' },
];

const suggestedFriends = [
  { name: 'Nguyễn Văn A', mutual: 5 },
  { name: 'Trần Thị B', mutual: 3 },
  { name: 'Lê Hoàng C', mutual: 8 },
];

const RightSidebar: React.FC = () => {
  return (
    <aside className="hidden xl:block fixed right-0 top-14 bottom-0 w-80 p-4 overflow-y-auto">
      {/* Daily Rewards */}
      <Card className="mb-4 border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-5 w-5 text-primary" />
            Phần thưởng hàng ngày
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-primary">+50</p>
              <p className="text-sm text-muted-foreground">CAMLY COIN</p>
            </div>
            <div className="h-12 w-12 rounded-full gradient-chakra flex items-center justify-center animate-float">
              <span className="text-2xl">🪙</span>
            </div>
          </div>
          <Button className="w-full gradient-chakra hover:opacity-90 text-primary-foreground">
            Điểm danh nhận thưởng
          </Button>
        </CardContent>
      </Card>

      {/* Trending */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            Xu hướng
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trendingTopics.map((topic) => (
            <div key={topic.tag} className="group cursor-pointer">
              <p className="font-semibold text-primary group-hover:underline">{topic.tag}</p>
              <p className="text-sm text-muted-foreground">{topic.posts}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Suggested Friends */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Gợi ý kết bạn
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedFriends.map((friend) => (
            <div key={friend.name} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/placeholder.svg" />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {friend.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{friend.name}</p>
                <p className="text-sm text-muted-foreground">{friend.mutual} bạn chung</p>
              </div>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                Kết bạn
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
};

export default RightSidebar;
