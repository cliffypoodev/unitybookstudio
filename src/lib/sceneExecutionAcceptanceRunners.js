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
              code: {
                type: 'string',
                enum: [
                  'REQUIRED_EVENT_MISSING',
                  'EXIT_STATE_MISSING',
                  'POV_IDENTITY_MISSING',
                  'REQUIRED_CONTINUITY_MISSING',
                  'SCENE_GOAL_MISSING',
                  'FUTURE_EVENT_EARLY_PERFORMED',
                  'FUTURE_EVENT_VIOLATION',
                  'UNSUPPORTED_EVENT_MECHANISM',
                  'UNSUPPORTED_EVENT_OPERATION',
                  'FORBIDDEN_EVENT_VIOLATION',
                  'UNSUPPORTED_HISTORY_OR_KNOWLEDGE',
                  'UNSUPPORTED_SETTING_DETAIL',
                  'EXIT_BOUNDARY_OVERRUN',
                  'POV_IDENTITY_DRIFT',
                  'VOICE_RULE_VIOLATION'
                ]
              },
              excerpt: { type: 'string' },
              offset: { type: 'integer' },
              classification: {
                type: 'string',
                enum: ['omission', 'repair_eligible', 'non_repairable']
              }
            },
            required: ['code', 'excerpt', 'offset', 'classification'],
            additionalProperties: false
          }
        },
        coverage: {
          type: 'object',
          properties: {
            entry_state_satisfied: { type: 'string' },
            exit_state_attained: { type: 'string' },
            required_events_satisfied: { type: 'string' },
            forbidden_events_avoided: { type: 'string' },
            continuity_satisfied: { type: 'string' }
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
      additionalProperties: false
    };

    const prompt = `Evaluate the following scene prose against its contract. Return the required JSON object exactly matching the provided schema.

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
      issue
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

    const prompt = `Perform exactly one surgical replacement for the following issue. Do not rewrite the whole scene. Preserve surrounding voice and continuity. Only replacement_text should be newly generated; everything else must strictly match the provided issue details.

Issue Code: ${issue.code}
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
