export function useMoney() {
  const formatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  })

  function format(amount: number) {
    return formatter.format(amount)
  }

  return { format }
}
