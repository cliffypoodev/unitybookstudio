import { invokeLLMWithRetry } from './integrationRetry.js';

export function createSceneExecutionAcceptanceRunners({
  invoke = invokeLLMWithRetry,
  project = null,
} = {}) {

  const auditRunner = async (request) => {
    const {
      contract_fingerprint,
      scene_id,
      scene_number,
      packet,
      prose,
      private_future_authority
    } = request;

    const response_json_schema = {
      type: 'object',
      properties: {
        version: { type: 'string', const: 'scene-execution-acceptance-gate-v1' },
        contract_fingerprint: { type: 'string', const: contract_fingerprint },
        scene_id: { type: 'string', const: scene_id },
        scene_number: { type: 'integer', const: scene_number },
        packet_id: { type: 'string', const: packet.packet_id },
        status: { type: 'string', enum: ['clean', 'issues_found'] },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              classification: { type: 'string' },
              excerpt: { type: 'string', minLength: 1 },
              offset: { type: 'integer', minimum: 0 }
            },
            required: ['code', 'classification', 'excerpt', 'offset'],
            additionalProperties: false,
            anyOf: [
              { properties: { code: { const: 'REQUIRED_EVENT_MISSING' }, classification: { const: 'omission' } } },
              { properties: { code: { const: 'EXIT_STATE_MISSING' }, classification: { const: 'omission' } } },
              { properties: { code: { const: 'POV_IDENTITY_MISSING' }, classification: { const: 'omission' } } },
              { properties: { code: { const: 'REQUIRED_CONTINUITY_MISSING' }, classification: { const: 'omission' } } },
              { properties: { code: { const: 'SCENE_GOAL_MISSING' }, classification: { const: 'omission' } } },
              { properties: { code: { const: 'FUTURE_EVENT_EARLY_PERFORMED' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'FUTURE_EVENT_VIOLATION' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'UNSUPPORTED_EVENT_MECHANISM' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'UNSUPPORTED_EVENT_OPERATION' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'FORBIDDEN_EVENT_VIOLATION' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'UNSUPPORTED_HISTORY_OR_KNOWLEDGE' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'UNSUPPORTED_SETTING_DETAIL' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'EXIT_BOUNDARY_OVERRUN' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'POV_IDENTITY_DRIFT' }, classification: { const: 'repair_eligible' } } },
              { properties: { code: { const: 'VOICE_RULE_VIOLATION' }, classification: { const: 'non_repairable' } } }
            ]
          }
        },
        coverage: {
          type: 'object',
          properties: {
            entry_state_satisfied: { type: 'string', enum: ['verified', 'unverified', 'failed'] },
            exit_state_attained: { type: 'string', enum: ['verified', 'unverified', 'failed'] },
            required_events_satisfied: { type: 'string', enum: ['verified', 'unverified', 'failed'] },
            forbidden_events_avoided: { type: 'string', enum: ['verified', 'unverified', 'failed'] },
            continuity_satisfied: { type: 'string', enum: ['verified', 'unverified', 'failed'] }
          },
          required: [
            'entry_state_satisfied',
            'exit_state_attained',
            'required_events_satisfied',
            'forbidden_events_avoided',
            'continuity_satisfied'
          ],
          additionalProperties: false
        }
      },
      required: ['version', 'contract_fingerprint', 'scene_id', 'scene_number', 'packet_id', 'status', 'issues', 'coverage'],
      additionalProperties: false,
      if: {
        properties: { status: { const: 'clean' } }
      },
      then: {
        properties: {
          issues: { maxItems: 0 },
          coverage: {
            properties: {
              entry_state_satisfied: { const: 'verified' },
              exit_state_attained: { const: 'verified' },
              required_events_satisfied: { const: 'verified' },
              forbidden_events_avoided: { const: 'verified' },
              continuity_satisfied: { const: 'verified' }
            }
          }
        }
      },
      else: {
        properties: {
          issues: { minItems: 1, maxItems: 1 }
        }
      }
    };

    const prompt = `Evaluate the following scene prose against its contract. Return the required JSON object exactly matching the provided schema.

- return clean only when no issue exists
- clean requires issues: [] and all coverage values: "verified"
- issues_found requires exactly one highest-priority issue
- use the taxonomy's listed order when multiple issues exist
- classification must match that issue code
- excerpt must be copied byte-for-byte from prose
- offset is the exact zero-based start position of that excerpt
- do not invent contract facts

Identity Fields:
Version: scene-execution-acceptance-gate-v1
Contract Fingerprint: ${contract_fingerprint}
Scene ID: ${scene_id}
Scene Number: ${scene_number}
Packet ID: ${packet.packet_id}

Packet:
${JSON.stringify(packet, null, 2)}

Private Future Authority:
${JSON.stringify(private_future_authority, null, 2)}

Prose:
${prose}
`;

    const result = await invoke({
      task_type: 'evaluate',
      temperature: 0.1,
      prompt,
      response_json_schema,
      project
    });

    return result;
  };

  const repairRunner = async (request) => {
    const {
      contract_fingerprint,
      scene_id,
      scene_number,
      packet,
      prose,
      issue,
      private_future_authority
    } = request;

    const response_json_schema = {
      type: 'object',
      properties: {
        version: { type: 'string', const: 'scene-execution-acceptance-gate-v1' },
        contract_fingerprint: { type: 'string', const: contract_fingerprint },
        scene_id: { type: 'string', const: scene_id },
        scene_number: { type: 'integer', const: scene_number },
        packet_id: { type: 'string', const: packet.packet_id },
        status: { type: 'string', const: 'repaired' },
        replacements: {
          type: 'array',
          minItems: 1,
          maxItems: 1,
          items: {
            type: 'object',
            properties: {
              issue_code: { type: 'string', const: issue.code },
              start: { type: 'integer', const: issue.offset },
              end: { type: 'integer', const: issue.offset + issue.excerpt.length },
              original_excerpt: { type: 'string', const: issue.excerpt },
              replacement_text: { type: 'string' }
            },
            required: ['issue_code', 'start', 'end', 'original_excerpt', 'replacement_text'],
            additionalProperties: false
          }
        }
      },
      required: ['version', 'contract_fingerprint', 'scene_id', 'scene_number', 'packet_id', 'status', 'replacements'],
      additionalProperties: false
    };

    const prompt = `Perform exactly one surgical replacement for the following issue.

- the issue is FUTURE_EVENT_EARLY_PERFORMED
- replace only the exact offending excerpt
- do not perform or reveal the reserved future event
- preserve surrounding voice, continuity, and established facts
- do not add unrelated events
- do not rewrite the scene

Identity Fields:
Version: scene-execution-acceptance-gate-v1
Contract Fingerprint: ${contract_fingerprint}
Scene ID: ${scene_id}
Scene Number: ${scene_number}
Packet ID: ${packet.packet_id}

Packet:
${JSON.stringify(packet, null, 2)}

Private Future Authority:
${JSON.stringify(private_future_authority, null, 2)}

Issue:
Code: ${issue.code}
Excerpt: "${issue.excerpt}"
Offset: ${issue.offset}

Prose Context:
${prose}
`;

    const result = await invoke({
      task_type: 'fix',
      temperature: 0.1,
      prompt,
      response_json_schema,
      project
    });

    return result;
  };

  return Object.freeze({
    auditRunner,
    repairRunner
  });
}
