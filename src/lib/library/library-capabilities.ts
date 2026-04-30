import { LIBRARY_PERMISSIONS as P } from "@/lib/library/library.permissions";

export type LibraryCapabilities = {
  isSchoolAdmin: boolean;
  booksRead: boolean;
  booksCreate: boolean;
  booksUpdate: boolean;
  booksArchive: boolean;
  copiesRead: boolean;
  copiesCreate: boolean;
  copiesUpdate: boolean;
  loansRead: boolean;
  loansIssue: boolean;
  loansReturn: boolean;
  loansRenew: boolean;
  loansMarkLost: boolean;
  loansMarkDamaged: boolean;
  finesRead: boolean;
  finesWaive: boolean;
  reportsView: boolean;
  settingsManage: boolean;
  noticesManage: boolean;
  reservationsRead: boolean;
  reservationsManage: boolean;
};

/** School admin may do everything; otherwise booleans mirror merged delegation permission codes. */
export function resolveLibraryCapabilities(
  isSchoolAdmin: boolean,
  mergedPermissionCodes: string[]
): LibraryCapabilities {
  if (isSchoolAdmin) {
    return {
      isSchoolAdmin: true,
      booksRead: true,
      booksCreate: true,
      booksUpdate: true,
      booksArchive: true,
      copiesRead: true,
      copiesCreate: true,
      copiesUpdate: true,
      loansRead: true,
      loansIssue: true,
      loansReturn: true,
      loansRenew: true,
      loansMarkLost: true,
      loansMarkDamaged: true,
      finesRead: true,
      finesWaive: true,
      reportsView: true,
      settingsManage: true,
      noticesManage: true,
      reservationsRead: true,
      reservationsManage: true,
    };
  }
  const has = (code: string) => mergedPermissionCodes.includes(code);
  return {
    isSchoolAdmin: false,
    booksRead: has(P.BOOKS_READ),
    booksCreate: has(P.BOOKS_CREATE),
    booksUpdate: has(P.BOOKS_UPDATE),
    booksArchive: has(P.BOOKS_ARCHIVE),
    copiesRead: has(P.COPIES_READ),
    copiesCreate: has(P.COPIES_CREATE),
    copiesUpdate: has(P.COPIES_UPDATE),
    loansRead: has(P.LOANS_READ),
    loansIssue: has(P.LOANS_ISSUE),
    loansReturn: has(P.LOANS_RETURN),
    loansRenew: has(P.LOANS_RENEW),
    loansMarkLost: has(P.LOANS_MARK_LOST),
    loansMarkDamaged: has(P.LOANS_MARK_DAMAGED),
    finesRead: has(P.FINES_READ),
    finesWaive: has(P.FINES_WAIVE),
    reportsView: has(P.REPORTS_VIEW),
    settingsManage: has(P.SETTINGS_MANAGE),
    noticesManage: has(P.NOTICES_MANAGE),
    reservationsRead: has(P.RESERVATIONS_READ),
    reservationsManage: has(P.RESERVATIONS_MANAGE),
  };
}
