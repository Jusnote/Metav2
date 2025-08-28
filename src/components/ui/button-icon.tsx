import { ChevronRightIcon } from 'lucide-react';
import { Button } from './button';

interface ButtonIconProps {
  onClick?: () => void;
}

export function ButtonIcon({ onClick }: ButtonIconProps) {
  return (
    <Button variant="secondary" size="icon" className="size-8" onClick={onClick}>
      <ChevronRightIcon />
    </Button>
  );
}