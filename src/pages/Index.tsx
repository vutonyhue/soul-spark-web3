import React from 'react';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import Feed from '@/components/feed/Feed';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LeftSidebar />
      
      <main className="pt-14 lg:pl-72 xl:pr-80">
        <div className="p-4">
          <Feed />
        </div>
      </main>
      
      <RightSidebar />
    </div>
  );
};

export default Index;
