interface ToggleProps {
  checked: boolean
  onChange: () => void
}

export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <div
      onClick={onChange}
      className={`w-[36px] h-[20px] rounded-full relative cursor-pointer transition-colors duration-200 shrink-0 ${checked ? 'bg-[#4080FF]' : 'bg-[#E5E6EB]'}`}
    >
      <div
        className={`absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
      />
    </div>
  )
}
