import React from 'react';
import { useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layouts/AdminLayout';

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
          <p className="text-gray-600">View and manage user information</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <p className="text-gray-500">User ID: {userId}</p>
            <p className="text-sm text-gray-400 mt-2">
              User details functionality will be implemented here
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}