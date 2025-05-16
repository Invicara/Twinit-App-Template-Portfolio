import React, { useState } from 'react'

import './PasswordInput.scss'

// PasswordInput displays a password input with a view/hide switch
const PasswordInput = ({ value, onChange }) => {

   const [ type, setType ] = useState('password')

   return <div className='password-input'>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}></input>
      {type === 'text' && <i className='fas fa-eye fa-2x' onClick={() => setType('password')}></i>}
      {type === 'password' && <i className='fas fa-eye-slash fa-2x' onClick={() => setType('text')}></i>}
   </div>
   

}

export default PasswordInput