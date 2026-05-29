import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { backendUrl, currency } from '../App';
import { toast } from 'react-toastify';

function List({ token }) {
  const [list, setList] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);

  const fetchList = async () => {
    try {
      const response = await axios.get(backendUrl + '/api/product/list');
      if (response.data.products) {
        setList(response.data.products);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    }
  };

  const removeProduct = async (id) => {
    try {
      const response = await axios.post(
        backendUrl + '/api/product/remove',
        { id },
        { headers: { token } }
      );
      if (response.data.success) {
        toast.success(response.data.message);
        await fetchList();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', editingProduct.name);
      formData.append('description', editingProduct.description);
      formData.append('mainDescription', editingProduct.mainDescription);
      formData.append('bestseller', editingProduct.bestseller);
      const normalizedQuantityOptions = editingProduct.quantityOptions.map((opt) => {
        const entry = { label: opt.label, price: Number(opt.price) };
        if (opt.originalPrice !== '' && opt.originalPrice != null) {
          entry.originalPrice = Number(opt.originalPrice);
        }
        return entry;
      });
      formData.append('quantityOptions', JSON.stringify(normalizedQuantityOptions));

      // append new images (if any)
      editingProduct.image1 && formData.append('image1', editingProduct.image1);
      editingProduct.image2 && formData.append('image2', editingProduct.image2);
      editingProduct.image3 && formData.append('image3', editingProduct.image3);
      editingProduct.image4 && formData.append('image4', editingProduct.image4);

      const response = await axios.post(
        `${backendUrl}/api/product/update/${editingProduct._id}`,
        formData,
        { headers: { token } }
      );

      if (response.data.success) {
        toast.success('Product updated successfully!');
        setEditingProduct(null);
        fetchList();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  return (
    <>
      <p className="mb-2 font-bold">All Products List</p>
      <div className="flex flex-col gap-2">
        <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr] items-center py-1 px-2 border bg-gray-100 text-sm">
          <b className="text-left">Image</b>
          <b className="text-left">Name</b>
          <b className="text-center">Selling</b>
          <b className="text-center">Sourced</b>
          <b className="text-center">Actions</b>
        </div>

        {list.reverse().map((item, index) => (
          <div
            className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr] items-center gap-2 py-1 px-2 border text-sm"
            key={index}
          >
            <img className="w-12" src={item.image[0]} alt={item.name} />
            <p>{item.name}</p>
            <p className="text-center font-medium">
              {currency} {item.quantityOptions?.[0]?.price ?? 'N/A'}
            </p>
            <p className="text-center font-medium text-gray-700">
              {item.quantityOptions?.[0]?.originalPrice != null
                ? `${currency} ${item.quantityOptions[0].originalPrice}`
                : '—'}
            </p>
            <p
              onClick={() => removeProduct(item._id)}
              className="text-center cursor-pointer text-red-600 font-bold"
            >
              X
            </p>
            <p
              onClick={() =>
                setEditingProduct({
                  ...item,
                  quantityOptions: (item.quantityOptions || []).map((opt) => ({
                    ...opt,
                    originalPrice: opt.originalPrice ?? '',
                  })),
                })
              }
              className="text-center cursor-pointer text-blue-600 font-bold"
            >
              ✏️
            </p>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-green-50 bg-opacity-40 z-50 flex items-center justify-center px-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-slate-50 shadow-md border rounded-xl w-full max-w-2xl p-6 md:p-10 overflow-y-auto max-h-[90vh] text-green-800"
          >
            <h2 className="text-xl font-bold mb-6">Edit Product</h2>

            {/* Product Name */}
            <div className="mb-4">
              <p className="mb-2">Product name</p>
              <input
                type="text"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>

            {/* Description */}
            {/* <div className="mb-4">
              <p className="mb-2">Product description (S)</p>
              <textarea
                value={editingProduct.description}
                onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div> */}

            {/* Main Description */}
            {/* <div className="mb-4">
              <p className="mb-2">Product description (L)</p>
              <textarea
                value={editingProduct.mainDescription}
                onChange={(e) => setEditingProduct({ ...editingProduct, mainDescription: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div> */}

            {/* Quantity Options */}
            <div className="mb-4">
              <p className="mb-2">Quantity Options</p>
              {editingProduct.quantityOptions.map((opt, i) => (
                <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => {
                      const updated = [...editingProduct.quantityOptions];
                      updated[i].label = e.target.value;
                      setEditingProduct({ ...editingProduct, quantityOptions: updated });
                    }}
                    className="px-3 py-2 w-[120px] border rounded"
                    placeholder="Label"
                    required
                  />
                  <input
                    type="number"
                    value={opt.price}
                    onChange={(e) => {
                      const updated = [...editingProduct.quantityOptions];
                      updated[i].price = e.target.value;
                      setEditingProduct({ ...editingProduct, quantityOptions: updated });
                    }}
                    className="px-3 py-2 w-[130px] border rounded"
                    placeholder="₹ Selling price"
                    min="0"
                    step="0.01"
                    required
                  />
                  <input
                    type="number"
                    value={opt.originalPrice ?? ''}
                    onChange={(e) => {
                      const updated = [...editingProduct.quantityOptions];
                      updated[i].originalPrice = e.target.value;
                      setEditingProduct({ ...editingProduct, quantityOptions: updated });
                    }}
                    className="px-3 py-2 w-[130px] border rounded"
                    placeholder="₹ Sourced price"
                    min="0"
                    step="0.01"
                  />
                  {i > 0 && (
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => {
                        const updated = editingProduct.quantityOptions.filter((_, idx) => idx !== i);
                        setEditingProduct({ ...editingProduct, quantityOptions: updated });
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setEditingProduct({
                    ...editingProduct,
                    quantityOptions: [...editingProduct.quantityOptions, { label: '', price: '', originalPrice: '' }]
                  })
                }
                className="text-green-800 text-sm"
              >
                + Add More Options
              </button>
            </div>

            {/* Bestseller checkbox */}
            <div className="flex gap-2 mb-4">
              <input
                type="checkbox"
                checked={editingProduct.bestseller}
                onChange={() =>
                  setEditingProduct({ ...editingProduct, bestseller: !editingProduct.bestseller })
                }
                id="bestseller"
              />
              <label htmlFor="bestseller" className="cursor-pointer">Add to bestseller</label>
            </div>

            {/* Images */}
            {/* <div className="mb-6">
              <p className="mb-2">Update Images (optional)</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((num) => (
                  <label key={num} htmlFor={`edit_image${num}`}>
                    <img
                      className="w-20 h-20 object-cover border rounded"
                      src={
                        editingProduct[`image${num}`]
                          ? URL.createObjectURL(editingProduct[`image${num}`])
                          : editingProduct.image?.[num - 1] || '/placeholder.jpg'
                      }
                      alt={`Image ${num}`}
                    />
                    <input
                      type="file"
                      id={`edit_image${num}`}
                      hidden
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, [`image${num}`]: e.target.files[0] })
                      }
                    />
                  </label>
                ))}
              </div>
            </div> */}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-green-800 text-white rounded">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

    </>
  );
}

export default List;
