import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, User, Hash, FileText, Plus, Edit2, Trash2, Save, Filter } from 'lucide-react';
import { ActionItem } from '../types/action';
import { db } from '../services/database';
import { syncService } from '../services/syncService';

interface ActionTrackerModalProps {
  onClose: () => void;
}

const ActionTrackerModal: React.FC<ActionTrackerModalProps> = ({ onClose }) => {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Closed' | 'InProgress' | 'Delay' | ''>('all');
  const [syncStatus, setSyncStatus] = useState(syncService.getSyncStatus());

  useEffect(() => {
    loadActionItems();
    
    // Subscribe to sync status changes
    const unsubscribe = syncService.onSyncStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  const loadActionItems = async () => {
    try {
      const items = await db.getAllActionItems();
      setActionItems(items);
    } catch (error) {
      console.error('Failed to load action items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newItem: ActionItem = {
      id: crypto.randomUUID(),
      no: actionItems.length + 1,
      meeting: '',
      actionItem: '',
      pic: '',
      dueDate: '',
      remarks: '',
      status: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingItem(newItem);
    setIsCreating(true);
  };

  const handleEdit = (item: ActionItem) => {
    setEditingItem({ ...item });
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editingItem) return;

    try {
      if (isCreating) {
        await db.createActionItem(editingItem);
      } else {
        await db.updateActionItem(editingItem.id, editingItem);
      }
      
      await loadActionItems();
      setEditingItem(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to save action item:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this action item?')) {
      try {
        await db.deleteActionItem(id);
        await loadActionItems();
      } catch (error) {
        console.error('Failed to delete action item:', error);
      }
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
    setIsCreating(false);
  };

  const handleSync = async () => {
    if (!syncStatus.isOnline || syncStatus.isSyncing) return;
    
    try {
      await syncService.sync();
      await loadActionItems();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const filteredItems = actionItems.filter(item => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Closed':
        return 'bg-green-100 text-green-800';
      case 'InProgress':
        return 'bg-blue-100 text-blue-800';
      case 'Delay':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading action items...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CheckSquare className="w-5 h-5 mr-2" />
            Action Tracker
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              {/* Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">All Status</option>
                  <option value="">No Status</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Delay">Delay</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              
              {/* Sync Status */}
              <div className="text-sm text-gray-600">
                {syncStatus.pendingChanges > 0 && (
                  <span className="text-blue-600 font-medium">
                    {syncStatus.pendingChanges} pending changes
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Sync Button */}
              <button
                onClick={handleSync}
                disabled={!syncStatus.isOnline || syncStatus.isSyncing}
                className="flex items-center px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                <CheckSquare className={`w-4 h-4 mr-2 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                {syncStatus.isSyncing ? 'Syncing...' : 'Sync'}
              </button>

              {/* Add New Button */}
              <button
                onClick={handleCreateNew}
                className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Action Item
              </button>
            </div>
          </div>

          {/* Action Items Table */}
          {filteredItems.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        <div className="flex items-center">
                          <Hash className="w-4 h-4 mr-1" />
                          No
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Meeting
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <CheckSquare className="w-4 h-4 mr-1" />
                          Action Item
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          PIC
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Due Date
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Remarks
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.no}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                          {item.meeting}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {item.actionItem}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.pic}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          {item.dueDate ? formatDate(item.dueDate) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {item.status ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(item.status)}`}>
                              {item.status}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {item.remarks || '-'}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1 text-blue-600 hover:text-blue-800 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-red-600 hover:text-red-800 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filterStatus === 'all' ? 'No Action Items Found' : `No ${filterStatus || 'Unassigned'} Action Items`}
              </h3>
              <p className="text-gray-500 mb-4">
                {filterStatus === 'all' 
                  ? 'Create action items to track meeting outcomes and responsibilities.'
                  : 'No action items match the selected filter.'
                }
              </p>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Action Item
              </button>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {filteredItems.length > 0 ? 
              `Showing ${filteredItems.length} of ${actionItems.length} action items` : 
              'No action items to display'
            }
            {syncStatus.pendingChanges > 0 && (
              <span className="ml-4 text-blue-600 font-medium">
                • {syncStatus.pendingChanges} pending sync
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {isCreating ? 'Create Action Item' : 'Edit Action Item'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* No */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No.
                </label>
                <input
                  type="number"
                  value={editingItem.no}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, no: parseInt(e.target.value) || 0 } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Meeting */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting *
                </label>
                <input
                  type="text"
                  value={editingItem.meeting}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, meeting: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Meeting title or code"
                  required
                />
              </div>

              {/* Action Item */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Item *
                </label>
                <textarea
                  value={editingItem.actionItem}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, actionItem: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Describe the action item"
                  rows={3}
                  required
                />
              </div>

              {/* PIC */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIC (Person in Charge)
                </label>
                <input
                  type="text"
                  value={editingItem.pic}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, pic: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Responsible person"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editingItem.dueDate}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, dueDate: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editingItem.status}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">No Status</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Delay">Delay</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={editingItem.remarks}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, remarks: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Additional notes or comments"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editingItem.meeting.trim() || !editingItem.actionItem.trim()}
                className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {isCreating ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionTrackerModal;