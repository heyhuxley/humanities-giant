import type {LastResult, Option} from '../game/types';
import {correctCount, resultHeadline, usedLifelineNames} from '../lib/sessions/final-result-view';
import {formatNaira} from '../lib/sessions/ladder-view';
import {describeFinishReason} from '../lib/sessions/reveal-view';
import {AnswerSlab} from './stage/answer-slab';

type Props = Readonly<{
	winnings: number | null;
	finishReason: string | null;
	position: number | null;
	lastResult: LastResult;
	correctIndex: Option | null;
	contestantName: string | null;
	lifelinesUsed: {
		fiftyFifty: boolean;
		phone: boolean;
		audience: boolean;
	};
	question: { text: string; options: [string, string, string, string] } | null;
}>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function FinalResult({
	                            winnings,
	                            finishReason,
	                            position,
	                            lastResult,
	                            correctIndex,
	                            contestantName,
	                            lifelinesUsed,
	                            question,
                            }: Props) {
	const names = usedLifelineNames(lifelinesUsed);
	
	return (
		<section
			aria-labelledby="final-result-heading"
			data-stage="final-result"
			className="min-w-0 space-y-6 rounded-sm border border-rule bg-slab p-5 sm:p-7"
		>
			<header className="min-w-0 space-y-3">
				<h2 id="final-result-heading" data-stage="final-line" className="font-display text-2xl font-semibold text-bone">
					Game over
				</h2>
				<p data-countup="root" className="wrap-break-word font-display text-5xl font-semibold tabular-nums text-brass sm:text-6xl">
					<span data-stage="final-amounts" data-amount={String(winnings ?? 0)}>
						{formatNaira(winnings ?? 0)}
					</span>
					<span aria-hidden="true" data-countup-overlay></span>
				</p>
				<p data-stage="final-line" className="wrap-break-word text-lg font-semibold text-bone text-pretty">
					{resultHeadline({reason: finishReason, winnings, contestantName})}
				</p>
				<p className="text-bone-muted">{describeFinishReason(finishReason)}</p>
				<p data-stage="final-line" className="text-bone-muted">
					{correctCount({position: position ?? 0, lastResult})} of 15 questions answered correctly
				</p>
			</header>
			
			<div className="space-y-2 border-t border-rule pt-4">
				<h3 data-stage="final-line" className="font-display text-lg font-semibold text-bone">Lifelines used</h3>
				{names.length > 0 ? (
					<ul className="flex flex-wrap gap-2">
						{names.map((name) => <li key={name}
						                         className="rounded-sm border border-rule bg-ink px-3 py-2 text-sm">{name}</li>)}
					</ul>
				) : (
					<p className="text-bone-muted">No lifelines used</p>
				)}
			</div>
			
			{typeof correctIndex === 'number' && question !== null ? (
				<div className="min-w-0 space-y-3 border-t border-rule pt-5">
					<h3 className="font-display text-lg font-semibold text-bone">Last question</h3>
					<p className="break-words text-bone text-pretty">{question.text}</p>
					<ol className="grid min-w-0 grid-cols-1 gap-2">
						{question.options.map((option, index) => (
							<li key={index} className="min-w-0">
								<AnswerSlab
									letter={OPTION_LABELS[index]}
									text={option}
									state={correctIndex === index ? 'correct' : 'neutral'}
									icon={correctIndex === index ? '✓' : undefined}
									label={correctIndex === index ? 'Correct answer' : undefined}
									disabled
									type="button"
								/>
							</li>
						))}
					</ol>
				</div>
			) : null}
		</section>
	);
}
