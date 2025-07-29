import React from 'react'
import { assets } from '../assets/assets'

function Navbar({ setToken }) {
    return (
        <div className='flex items-center py-3 px-[4%] justify-between bg-green-50'>
            <div className='flex items-center'>
                <img className='w-14' src={assets.logo} alt="" />
                <h4 className='font-medium ms-2 text-green-800'>ADMIN PANEL</h4>
            </div>
            <button onClick={() => setToken('')} className='bg-green-700 text-white px-5 py-2 sm:px-7 sm:py-2 rounded-full text-xs sm:text-sm'>Logout</button>
        </div>
    )
}

export default Navbar