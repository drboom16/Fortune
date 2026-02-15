import InvestmentCalculator from "../components/InvestmentCalculator";

export default function InvestmentCalculatorPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Investment Calculator</h1>
      <InvestmentCalculator />
    </div>
  );
}
