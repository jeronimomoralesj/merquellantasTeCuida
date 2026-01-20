import React, { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

const DeleteAllUsersButton = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setResult(null);

    try {
      const response = await fetch('/api/delete-all-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          count: data.deletedCount
        });
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to delete users'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error.message || 'Network error occurred'
      });
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="text-red-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">Delete All Users</h2>
        </div>

        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-800">
              <p className="font-semibold mb-1">⚠️ Warning: This action is irreversible!</p>
              <p>This will delete ALL users from Firebase Authentication. This cannot be undone.</p>
            </div>
          </div>
        </div>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isDeleting}
            className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={20} />
            Delete All Users
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-center font-semibold text-gray-700">
              Are you absolutely sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete All'
                )}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${
            result.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-semibold ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? '✓ Success' : '✗ Error'}
            </p>
            <p className={`text-sm mt-1 ${
              result.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {result.message}
            </p>
            {result.count !== undefined && (
              <p className="text-sm text-green-700 mt-1">
                Deleted {result.count} users from Firebase Authentication
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeleteAllUsersButton;