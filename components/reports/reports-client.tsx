'use client';

import { ReportsFilters } from './reports-filters';
import { useReportFilters } from '@/lib/hooks/use-report-filters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Store {
  id: string;
  name: string;
}

interface ReportsClientProps {
  stores: Store[];
}

export function ReportsClient({ stores }: ReportsClientProps) {
  const { filters } = useReportFilters();

  const getReportTitle = () => {
    const typeLabel = filters.reportType === 'sales' ? 'Sales' :
                      filters.reportType === 'inventory' ? 'Inventory' : 'Performance';
    return `${typeLabel} Report`;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ReportsFilters stores={stores} />

      {/* Report Placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{getReportTitle()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Report generation will be implemented in Phase 4. The filtering system is ready.
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Current configuration:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Type: {filters.reportType}</li>
                <li>Group by: {filters.groupBy}</li>
                {filters.store && <li>Store: {filters.store}</li>}
                {filters.dateFrom && <li>From: {filters.dateFrom.toLocaleDateString()}</li>}
                {filters.dateTo && <li>To: {filters.dateTo.toLocaleDateString()}</li>}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Chart and data visualization will appear here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
