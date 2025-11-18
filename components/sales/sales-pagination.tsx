'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSaleFilters } from '@/lib/hooks/use-sale-filters';

interface SalesPaginationProps {
  currentPage: number;
  totalPages: number;
}

export function SalesPagination({ currentPage, totalPages }: SalesPaginationProps) {
  const { setFilters } = useSaleFilters();

  const goToPage = (page: number) => {
    setFilters({ page });
  };

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => goToPage(1)} disabled={!canGoPrevious}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="icon" onClick={() => goToPage(currentPage - 1)} disabled={!canGoPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isCurrentPage = pageNum === currentPage;

            return (
              <Button
                key={pageNum}
                variant={isCurrentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => goToPage(pageNum)}
                className="min-w-[40px]"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button variant="outline" size="icon" onClick={() => goToPage(currentPage + 1)} disabled={!canGoNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="icon" onClick={() => goToPage(totalPages)} disabled={!canGoNext}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
