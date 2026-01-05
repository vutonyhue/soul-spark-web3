import React from 'react';
import CreatePost from './CreatePost';
import PostCard from './PostCard';

const mockPosts = [
  {
    id: 1,
    author: {
      name: 'Fun Profile Official',
      verified: true,
    },
    content: '🎉 Chào mừng bạn đến với Fun Profile - Mạng xã hội Web3 đầu tiên của Việt Nam!\n\nKết nối ví ngay để nhận 100 CAMLY COIN miễn phí! 🪙✨\n\n#FunProfile #Web3 #CamlyCoin',
    timestamp: '2 giờ trước',
    likes: 1250,
    comments: 89,
    shares: 234,
    coinReward: 10,
  },
  {
    id: 2,
    author: {
      name: 'Nguyễn Minh Tâm',
    },
    content: 'Vừa tham gia Fun Profile và đã nhận được thưởng CAMLY COIN! Cảm ơn đội ngũ phát triển 💚\n\nAi chưa tham gia thì nhanh lên nhé, còn nhiều phần thưởng hấp dẫn lắm!',
    timestamp: '4 giờ trước',
    likes: 456,
    comments: 23,
    shares: 12,
  },
  {
    id: 3,
    author: {
      name: 'Trần Hoàng Anh',
      verified: true,
    },
    content: 'Heart Chakra - Luân xa số 4 🟢\n\nBiểu tượng của tình yêu, sự đồng cảm và kết nối. Đây chính là tinh thần mà Fun Profile mang đến cho cộng đồng Web3!\n\nHãy cùng nhau xây dựng một cộng đồng yêu thương và hỗ trợ lẫn nhau 💚',
    timestamp: '6 giờ trước',
    likes: 892,
    comments: 67,
    shares: 145,
    coinReward: 25,
  },
  {
    id: 4,
    author: {
      name: 'Lê Thị Hương',
    },
    content: 'Giao diện đẹp quá! Giống Facebook nhưng có thêm tính năng Web3 siêu xịn 🔥',
    timestamp: '8 giờ trước',
    likes: 234,
    comments: 15,
    shares: 8,
  },
];

const Feed: React.FC = () => {
  return (
    <div className="max-w-xl mx-auto">
      <CreatePost />
      
      {mockPosts.map((post) => (
        <PostCard
          key={post.id}
          author={post.author}
          content={post.content}
          timestamp={post.timestamp}
          likes={post.likes}
          comments={post.comments}
          shares={post.shares}
          coinReward={post.coinReward}
        />
      ))}
    </div>
  );
};

export default Feed;
