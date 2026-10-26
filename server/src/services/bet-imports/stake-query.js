// Compared with the exact browser query in tests/fixtures/stake/.
// fixture.id is present in the original Network response and added for grouping.
// Offline contract passes; this extended query still needs live validation.
// Deliberately do not request amount, currency, user or account information.
export const STAKE_BET_LOOKUP_QUERY = `query BetLookup($iid: String) {
  bet(iid: $iid) {
    id
    iid
    bet {
      __typename
      ... on SwishBet {
        potentialMultiplier
        status
        outcomes {
          lineType
          totalOdds
          outcome {
            line
            name
            competitor { name }
            market { game { fixture { id name } } }
          }
        }
      }
    }
  }
}`;
