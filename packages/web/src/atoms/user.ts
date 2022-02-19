import { atom } from 'jotai'
import { focusAtom } from 'jotai/optics'
import { atomWithStorage } from 'jotai/utils'

let userInfo = {
  _id: '',
  email: undefined,
  // DB save emailVerified: true / false
  // different provider have different emailState
  emailState: '', // like confirmed, unverified, ... 
  code: '',
  oauthProvider: '',
  logged: false,
  jwtToken: '',
}

export const userInfoAtom = atomWithStorage('userInfo',userInfo);
