import React from 'react';
import { Button } from "@lonestone/ui/components/primitives/button";
import { Link } from 'react-router';

export const Welcome: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Welcome to Lonestone</h2>
      <p className="text-gray-600">
        This is your starting point for building amazing applications.
      </p>
      <div>
        <Button asChild>
          <Link to="https://lonestone.io">
            Go to Lonestone.io
          </Link>
        </Button>
      </div>
    </div>
  );
};