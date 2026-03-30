import { Badge } from '@/components/ui/badge';
import { CASE_CATEGORY_CONFIG } from '@/lib/constants';
import type { CaseCategory } from '@/types/case';
import { cn } from '@/lib/utils';
import { Wrench, Truck, Package, HardHat, AlertTriangle, Box } from 'lucide-react';

const CATEGORY_ICONS: Record<CaseCategory, React.ReactNode> = {
  SUBCONTRACTOR: <HardHat className="h-3 w-3" />,
  RUST_SUBCONTRACTOR: <AlertTriangle className="h-3 w-3" />,
  DELIVERY_INSTALLATION: <Wrench className="h-3 w-3" />,
  FREIGHT_FINISHED_GOODS: <Truck className="h-3 w-3" />,
  FREIGHT_SPARE_PARTS: <Package className="h-3 w-3" />,
  FREIGHT_ADDITIONAL_CHARGES: <Box className="h-3 w-3" />,
};

interface CategoryBadgeProps {
  category: CaseCategory;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const config = CASE_CATEGORY_CONFIG[category];

  return (
    <Badge
      variant="outline"
      className={cn(config.bgColor, config.color, 'border-transparent font-medium inline-flex items-center gap-1')}
    >
      {CATEGORY_ICONS[category]}
      {config.label}
    </Badge>
  );
}
