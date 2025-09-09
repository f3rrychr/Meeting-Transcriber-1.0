export interface ActionItem {
  id: string;                // uuid
  no: number;                // row index (derived or stored)
  meeting: string;           // meeting title/code as shown
  actionItem: string;        // action description
  pic: string;               // editable tag-like field
  dueDate?: string;          // ISO date (YYYY-MM-DD)
  remarks?: string;          // editable free text
  status?: 'Closed' | 'InProgress' | 'Delay' | '';  // new dropdown, default ''
  createdAt: string;
  updatedAt: string;
}

// Database mappers for converting between DB and UI shapes
export interface ActionItemDB {
  id: string;
  no: number;
  meeting: string;
  action_item: string;  // snake_case for DB
  pic: string;
  due_date?: string;    // snake_case for DB
  remarks?: string;
  status?: string;
  created_at: string;   // snake_case for DB
  updated_at: string;   // snake_case for DB
}

// Mapper functions
export const mapActionItemFromDB = (dbItem: ActionItemDB): ActionItem => ({
  id: dbItem.id,
  no: dbItem.no,
  meeting: dbItem.meeting,
  actionItem: dbItem.action_item,
  pic: dbItem.pic,
  dueDate: dbItem.due_date,
  remarks: dbItem.remarks,
  status: (dbItem.status as 'Closed' | 'InProgress' | 'Delay' | '') || '',
  createdAt: dbItem.created_at,
  updatedAt: dbItem.updated_at
});

export const mapActionItemToDB = (uiItem: ActionItem): ActionItemDB => ({
  id: uiItem.id,
  no: uiItem.no,
  meeting: uiItem.meeting,
  action_item: uiItem.actionItem,
  pic: uiItem.pic,
  due_date: uiItem.dueDate,
  remarks: uiItem.remarks,
  status: uiItem.status || '',
  created_at: uiItem.createdAt,
  updated_at: uiItem.updatedAt
});