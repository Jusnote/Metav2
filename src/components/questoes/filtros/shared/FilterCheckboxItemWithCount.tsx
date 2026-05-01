import { FilterCheckboxItem } from './FilterCheckboxItem';

export interface FilterCheckboxItemWithCountProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  count?: number;
  disabled?: boolean;
}

export function FilterCheckboxItemWithCount(props: FilterCheckboxItemWithCountProps) {
  return (
    <FilterCheckboxItem
      label={props.label}
      checked={props.checked}
      onToggle={props.onToggle}
      count={props.count}
      disabled={props.disabled}
    />
  );
}
