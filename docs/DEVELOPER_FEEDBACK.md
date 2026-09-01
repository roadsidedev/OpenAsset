# Developer Feedback Loop

The developer ecosystem is successful only when an independent builder can reach a working adapter without founder support. This process captures friction from early developers, turns repeated issues into owned work, and feeds fixes back into code, tooling, and documentation.

## Early-builder interview

After a developer completes or abandons the quick start, ask:

1. Where did you get stuck?
2. What was unclear?
3. What did you expect to happen?
4. What was missing?
5. What would make you build again?
6. Which command, error, or document did you last see?
7. Could you reproduce the example and submit evidence without private context?

Record the adapter category, repository commit, environment, step reached, exact error/output, expected outcome, workaround, severity, and consent for attribution. Do not request private keys, personal data, or undisclosed exploit details in ordinary feedback.

## Intake channels and response

Use a GitHub issue with the `developer-feedback` label for ordinary friction, a documentation pull request for a direct wording/link fix, and the security reporting process for a suspected vulnerability. Triage new feedback weekly. A maintainer acknowledges it within two business days, assigns an owner, links the affected guide or code, and records a target release or explicit rationale for not changing it.

## Issue taxonomy

| Label | Meaning | Product response |
|---|---|---|
| `docs-gap` | Required concept or workflow is absent | Add or restructure documentation |
| `docs-unclear` | Existing wording caused a wrong expectation | Add example, warning, or terminology definition |
| `broken-command` | Install, test, scaffold, or submission command fails | Add regression check and fix tooling |
| `template-gap` | No credible starting implementation for a category | Add reference template and focused tests |
| `test-gap` | Failure or integration behavior is hard to exercise | Add mock, fixture, assertion, or error explanation |
| `sdk-gap` | Interface, helper, type, or error is missing | Extend SDK with compatibility note |
| `integration-gap` | ABI, event, registry, deployment, or chain detail is missing | Add integration example and manifest guidance |
| `security-confusion` | User could mistake a trust signal for a guarantee | Clarify security boundary and add warning |
| `performance-gap` | Gas, RPC, indexer, or local workflow is too slow | Measure, bound, and optimize or document limit |
| `feature-request` | New capability requested without current failure | Discuss in roadmap rather than silently expanding scope |

Suspected vulnerabilities use the private security process rather than public issue labels.

## From feedback to product ticket

A report becomes a product or documentation ticket when the same blocker appears twice, blocks a first successful adapter, causes a security misunderstanding, or requires undocumented founder knowledge. The ticket must include the user story, observed friction, expected behavior, affected categories, proposed fix, acceptance test, documentation location, owner, priority, and release target. Close the loop by asking the original developer to retry the exact path.

## Metrics

Track time from clone to compile, time from scaffold to first passing test, percentage of quick-start attempts reaching a passing custom adapter, number of founder interventions, repeated issue rate, documentation search gaps, failed command rate, template coverage, and resubmission causes. Review trends monthly. A metric is useful only when paired with a concrete owner and next action.

## Feedback form template

```text
Adapter category:
Repository commit / SDK version:
Operating system and Node version:
Step reached: read | install | copy | modify | test | submit
What did you try?
What happened? (include exact command and error)
What did you expect?
Where did you get stuck?
What was unclear or missing?
What workaround did you use?
Would you build again? Why or why not?
Suggested fix:
Permission to quote anonymously: yes/no
```
