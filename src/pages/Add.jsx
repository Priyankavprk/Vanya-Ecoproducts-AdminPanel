import React, { useState } from 'react'
import { assets } from '../assets/assets'
import axios from 'axios'
import { backendUrl } from '../App'
import { toast } from 'react-toastify'

function Add({ token }) {
  const [image1, setImage1] = useState(false)
  const [image2, setImage2] = useState(false)
  const [image3, setImage3] = useState(false)
  const [image4, setImage4] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mainDescription, setMainDescription] = useState('')
  const [bestseller, setBestseller] = useState(false)
  const [quantityOptions, setQuantityOptions] = useState([{ label: '', price: '' }])

  const onSubmitHandler = async (e) => {
    e.preventDefault()
    try {
      const formData = new FormData()

      formData.append("name", name)
      formData.append("description", description)
      formData.append("mainDescription", mainDescription)
      formData.append("bestseller", bestseller)
      formData.append("quantityOptions", JSON.stringify(quantityOptions))

      image1 && formData.append("image1", image1)
      image2 && formData.append("image2", image2)
      image3 && formData.append("image3", image3)
      image4 && formData.append("image4", image4)

      const response = await axios.post(backendUrl + "/api/product/add", formData, { headers: { token } })
      if (response.data.success) {
        toast.success(response.data.message)
        setName('')
        setDescription('')
        setMainDescription('')
        setBestseller(false)
        setQuantityOptions([{ label: '', price: '' }])
        setImage1(false)
        setImage2(false)
        setImage3(false)
        setImage4(false)
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <form onSubmit={onSubmitHandler} className='flex flex-col w-full items-start gap-3 border-1 shadow px-10 py-10 bg-slate-50'>
      <div>
        <p className='mb-2'>Upload Image</p>
        <div className='flex gap-2'>
          {[image1, image2, image3, image4].map((img, idx) => (
            <label key={idx} htmlFor={`image${idx + 1}`}>
              <img className='w-20' src={!img ? assets.upload_area : URL.createObjectURL(img)} alt="" />
              <input onChange={(e) => [setImage1, setImage2, setImage3, setImage4][idx](e.target.files[0])} type="file" id={`image${idx + 1}`} hidden />
            </label>
          ))}
        </div>
      </div>

      <div className='w-full'>
        <p className='mb-2'>Product name</p>
        <input onChange={(e) => setName(e.target.value)} value={name} type="text" placeholder='Type here' required className='w-full max-w-[500px] px-3 py-2' />
      </div>

      <div className='w-full'>
        <p className='mb-2'>Product description (S)</p>
        <textarea onChange={(e) => setDescription(e.target.value)} value={description} placeholder='Write content here' required className='w-full max-w-[500px] px-3 py-2' />
      </div>

      <div className='w-full'>
        <p className='mb-2'>Product description (L)</p>
        <textarea onChange={(e) => setMainDescription(e.target.value)} value={mainDescription} placeholder='Write content here' required className='w-full max-w-[500px] px-3 py-2' />
      </div>

      <div className='w-full'>
        <p className='mb-2'>Quantity Options</p>
        {quantityOptions.map((option, index) => (
          <div key={index} className='flex gap-2 mb-2'>
            <input
              type="text"
              placeholder="e.g. 500g"
              value={option.label}
              onChange={(e) => {
                const updated = [...quantityOptions];
                updated[index].label = e.target.value;
                setQuantityOptions(updated);
              }}
              className='px-3 py-2 w-[120px]'
              required
            />
            <input
              type="number"
              placeholder="₹ Price"
              value={option.price}
              onChange={(e) => {
                const updated = [...quantityOptions];
                updated[index].price = e.target.value;
                setQuantityOptions(updated);
              }}
              className='px-3 py-2 w-[120px]'
              required
            />
            {index > 0 && (
              <button type='button' onClick={() => {
                const updated = quantityOptions.filter((_, i) => i !== index);
                setQuantityOptions(updated);
              }} className='text-red-500'>Remove</button>
            )}
          </div>
        ))}
        <button type='button' className='text-green-800 text-sm' onClick={() => setQuantityOptions([...quantityOptions, { label: '', price: '' }])}>+ Add More Options</button>
      </div>

      <div className='flex gap-2 mt-2'>
        <input onChange={() => setBestseller(prev => !prev)} checked={bestseller} type="checkbox" id='bestseller' />
        <label htmlFor="bestseller" className='cursor-pointer'>Add to bestseller</label>
      </div>

      <button type='submit' className='w-28 py-3 mt-4 bg-green-800 text-white'>Add</button>
    </form>
  )
}

export default Add
