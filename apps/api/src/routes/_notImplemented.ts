import type { ApiResponse } from '@battu/shared'

export const NOT_IMPLEMENTED: ApiResponse<null> = {
  data: null,
  error: 'Not yet implemented',
}
