export const ITEM_CATEGORIES = [
  'Books',
  'Electronics',
  'Calculators',
  'Sports Equipment',
  'Project Components',
  'Accessories',
  'Art Supplies',
  'Clothing',
  'Other',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CONDITIONS = [
  'New',
  'Like New',
  'Good',
  'Fair',
] as const;

export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const ITEM_STATUSES = [
  'Available',
  'Reserved',
  'Borrowed',
  'Unavailable',
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const REQUEST_STATUSES = [
  'Pending',
  'Accepted',
  'Rejected',
  'Cancelled',
  'Borrowed',
  'Returned',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STUDENT_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Postgraduate',
  'PhD',
] as const;

export const REPORT_REASONS = [
  'Inappropriate Content',
  'Damaged or Misleading Item',
  'Late Return / No Show',
  'Harassment or Spam',
  'Prohibited Item',
  'Other',
] as const;

export const REPORT_STATUSES = [
  'Pending',
  'Resolved',
  'Dismissed',
] as const;

export const NOTIFICATION_TYPES = [
  'REQUEST_RECEIVED',
  'REQUEST_ACCEPTED',
  'REQUEST_REJECTED',
  'ITEM_HANDOVER',
  'ITEM_RETURNED',
  'REVIEW_RECEIVED',
  'SYSTEM',
] as const;
