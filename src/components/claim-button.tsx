import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClaimVerdict } from "@/lib/league/use-claim";

/**
 * One slot, nine conditions.
 *
 * The label only ever states what the press does. No amount is suggested and no
 * roster count is reported — the app has no basis for pricing a player for you,
 * and when somebody has to go the dialog simply asks who.
 */
export function ClaimButton({
  verdict,
  leagueId,
  onClaim,
  size = "md",
}: {
  verdict: ClaimVerdict;
  leagueId: string;
  onClaim: () => void;
  size?: "sm" | "md";
}) {
  switch (verdict.kind) {
    case "none":
      return null;

    case "predraft":
      return (
        <Button size={size} disabled>
          Opens after the draft
        </Button>
      );

    case "mine":
      return <Badge tone="win">Yours</Badge>;

    case "taken":
      return (
        <Button size={size} variant="outline" asChild>
          <Link to="/league/$leagueId/trades" params={{ leagueId }}>
            Propose a trade
          </Link>
        </Button>
      );

    // There is no update-claim on the server, only cancel, so this points at the
    // Waivers card on My Team where pulling it already works rather than opening
    // a dialog that would quietly file a second claim on the same player.
    case "pending":
      return (
        <Button size={size} variant="outline" asChild>
          <Link to="/league/$leagueId/roster" params={{ leagueId }}>
            {verdict.money ? `Bid in · $${verdict.bid}` : "Claim in"}
          </Link>
        </Button>
      );

    case "open":
      return (
        <Button size={size} onClick={onClaim}>
          {verdict.mode === "add" ? "Add to roster" : "Claim"}
        </Button>
      );
  }
}
